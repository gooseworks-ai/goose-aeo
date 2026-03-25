import { domainFromUrl, normalizeDomain } from '../../utils/domain.js'
import { truncate } from '../../utils/text.js'

// Priority paths to always include if they exist on the site
const PRIORITY_PATHS = [
  '/',
  '/about',
  '/pricing',
  '/product',
  '/features',
  '/solutions',
  '/blog',
  '/docs',
  '/integrations',
  '/use-cases',
  '/customers',
  '/case-studies',
]

const stripHtml = (html: string): string => {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const absoluteUrl = (domain: string, path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  return `https://${domain}${path.startsWith('/') ? '' : '/'}${path}`
}

const NON_CONTENT_EXTENSIONS = ['.xml', '.json', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js', '.woff', '.woff2']

const urlToPath = (url: string, domain: string): string | null => {
  try {
    const parsed = new URL(url)
    if (normalizeDomain(parsed.hostname) !== normalizeDomain(domain)) {
      return null
    }
    // Exclude non-content files
    const path = parsed.pathname
    if (NON_CONTENT_EXTENSIONS.some((ext) => path.endsWith(ext))) {
      return null
    }
    return path
  } catch {
    return null
  }
}

const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url)
    // Normalize: remove trailing slash (except root), lowercase host
    let path = parsed.pathname
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1)
    }
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${path}`
  } catch {
    return url
  }
}

// ---------------------------------------------------------------------------
// URL Discovery
// ---------------------------------------------------------------------------

const discoverViaFirecrawlMap = async (
  domain: string,
  apiKey: string,
): Promise<string[]> => {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: `https://${domain}`,
        limit: 200,
      }),
    })

    if (!response.ok) {
      return []
    }

    const payload = (await response.json()) as {
      success?: boolean
      links?: string[]
    }

    if (!payload.success || !Array.isArray(payload.links)) {
      return []
    }

    // Filter to same-domain URLs
    return payload.links.filter((link) => {
      const path = urlToPath(link, domain)
      return path !== null
    })
  } catch {
    return []
  }
}

const discoverViaSitemap = async (domain: string): Promise<string[]> => {
  const urls: string[] = []

  try {
    // Try sitemap.xml
    const response = await fetch(`https://${domain}/sitemap.xml`, {
      headers: { 'User-Agent': 'goose-aeo/0.1 (+https://gooseworks.sh)' },
    })

    if (!response.ok) {
      return []
    }

    const xml = await response.text()

    // Check for sitemap index — if found, try first child sitemap
    const sitemapIndexMatches = Array.from(
      xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/gi),
    )

    if (sitemapIndexMatches.length > 0) {
      const firstChildUrl = sitemapIndexMatches[0]?.[1]
      if (firstChildUrl) {
        try {
          const childResponse = await fetch(firstChildUrl, {
            headers: {
              'User-Agent': 'goose-aeo/0.1 (+https://gooseworks.sh)',
            },
          })
          if (childResponse.ok) {
            const childXml = await childResponse.text()
            const locMatches = Array.from(
              childXml.matchAll(/<loc>([^<]+)<\/loc>/gi),
            )
            for (const match of locMatches) {
              const url = match[1]
              if (url && urlToPath(url, domain) !== null) {
                urls.push(url)
              }
              if (urls.length >= 500) break
            }
          }
        } catch {
          // ignore child sitemap errors
        }
      }
    }

    // Also parse <loc> from the root sitemap itself
    const locMatches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi))
    for (const match of locMatches) {
      const url = match[1]
      if (url && urlToPath(url, domain) !== null) {
        urls.push(url)
      }
      if (urls.length >= 500) break
    }
  } catch {
    // sitemap not available
  }

  // Deduplicate
  return Array.from(new Set(urls))
}

const collectRootLinks = (rootHtml: string, domain: string): string[] => {
  const hrefMatches = Array.from(rootHtml.matchAll(/href=["']([^"']+)["']/gi))
  const links = new Set<string>()

  for (const match of hrefMatches) {
    const href = match[1]
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')
    ) {
      continue
    }

    try {
      const url = new URL(href, `https://${domain}`)
      if (normalizeDomain(url.hostname) === normalizeDomain(domain)) {
        links.add(url.pathname)
      }
    } catch {
      continue
    }
  }

  return Array.from(links).slice(0, 50)
}

// ---------------------------------------------------------------------------
// Page Sampling
// ---------------------------------------------------------------------------

const samplePages = (urls: string[], domain: string, maxPages: number): string[] => {
  const selected = new Set<string>()

  // Always include homepage
  const homeUrl = `https://${domain}/`
  if (urls.some((u) => urlToPath(u, domain) === '/')) {
    selected.add(homeUrl)
  }

  // Add priority paths that actually exist in discovered URLs
  for (const priorityPath of PRIORITY_PATHS) {
    if (selected.size >= maxPages) break
    const match = urls.find((u) => urlToPath(u, domain) === priorityPath)
    if (match) {
      selected.add(match)
    }
  }

  if (selected.size >= maxPages) {
    return Array.from(selected).slice(0, maxPages)
  }

  // Group remaining URLs by first path segment
  const groups = new Map<string, string[]>()
  for (const url of urls) {
    if (selected.has(url)) continue
    const path = urlToPath(url, domain)
    if (!path) continue
    const segments = path.split('/').filter(Boolean)
    const group = segments[0] ?? '_root'
    const existing = groups.get(group) ?? []
    existing.push(url)
    groups.set(group, existing)
  }

  // Sort each group by path length (shorter = more likely a landing page)
  for (const key of Array.from(groups.keys())) {
    const groupUrls = groups.get(key)!
    groups.set(key, groupUrls.sort((a, b) => a.length - b.length))
  }

  // Round-robin from each group
  const groupKeys = Array.from(groups.keys())
  let idx = 0
  while (selected.size < maxPages && groupKeys.length > 0) {
    const key = groupKeys[idx % groupKeys.length]!
    const groupUrls = groups.get(key)!
    const next = groupUrls.shift()
    if (next) {
      selected.add(next)
    }
    if (groupUrls.length === 0) {
      groupKeys.splice(idx % groupKeys.length, 1)
      if (groupKeys.length === 0) break
    } else {
      idx++
    }
  }

  return Array.from(selected).slice(0, maxPages)
}

// ---------------------------------------------------------------------------
// Unified Discovery
// ---------------------------------------------------------------------------

const discoverPages = async (args: {
  domain: string
  firecrawlApiKey?: string
  maxPages?: number
}): Promise<string[]> => {
  const domain = normalizeDomain(args.domain)
  const maxPages = args.maxPages ?? 20

  const dedup = (urls: string[]): string[] => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const url of urls) {
      const key = normalizeUrl(url)
      if (!seen.has(key)) {
        seen.add(key)
        result.push(key)
      }
    }
    return result
  }

  // 1. Try Firecrawl map
  if (args.firecrawlApiKey) {
    const mapUrls = await discoverViaFirecrawlMap(domain, args.firecrawlApiKey)
    if (mapUrls.length > 0) {
      return samplePages(dedup(mapUrls), domain, maxPages)
    }
  }

  // 2. Try sitemap.xml
  const sitemapUrls = await discoverViaSitemap(domain)
  if (sitemapUrls.length > 0) {
    return samplePages(dedup(sitemapUrls), domain, maxPages)
  }

  // 3. Fall back to homepage link extraction
  const rootUrl = absoluteUrl(domain, '/')
  const rootHtml = await fetchPlainText(rootUrl)
  const rootLinks = rootHtml ? collectRootLinks(rootHtml, domain) : []
  const fallbackUrls = rootLinks.map((path) => absoluteUrl(domain, path))

  // Ensure homepage is included
  if (!fallbackUrls.includes(rootUrl)) {
    fallbackUrls.unshift(rootUrl)
  }

  return dedup(fallbackUrls).slice(0, maxPages)
}

// ---------------------------------------------------------------------------
// Page Fetching
// ---------------------------------------------------------------------------

interface FirecrawlScrapeResponse {
  success?: boolean
  data?: {
    markdown?: string
    content?: string
    metadata?: {
      statusCode?: number
    }
  }
}

const fetchViaFirecrawl = async (
  url: string,
  apiKey: string,
): Promise<string | null> => {
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 30000,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as FirecrawlScrapeResponse

  if (!payload.success || !payload.data) {
    return null
  }

  // Check HTTP status code from Firecrawl metadata
  const statusCode = payload.data.metadata?.statusCode
  if (statusCode && statusCode >= 400) {
    return null
  }

  const content = payload.data.markdown ?? payload.data.content ?? null

  // Skip very short content (likely error pages or empty shells)
  if (content && content.length < 100) {
    return null
  }

  return content
}

const fetchPlainText = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'goose-aeo/0.1 (+https://gooseworks.sh)',
      },
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()
    const text = stripHtml(html)

    // Skip very short content
    if (text.length < 100) {
      return null
    }

    return text
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PageContent {
  url: string
  content: string
}

export interface ScrapeResult {
  description: string
  combinedContent: string
  pages: string[]
}

export const scrapePagesSeparately = async (args: {
  domain: string
  firecrawlApiKey?: string
  maxPages?: number
}): Promise<PageContent[]> => {
  const urls = await discoverPages(args)
  const results: PageContent[] = []

  for (const url of urls) {
    const content = args.firecrawlApiKey
      ? await fetchViaFirecrawl(url, args.firecrawlApiKey)
      : await fetchPlainText(url)

    if (content) {
      results.push({ url, content: truncate(content, 15_000) })
    }
  }

  return results
}

export const scrapeDomainContent = async (args: {
  domain: string
  firecrawlApiKey?: string
}): Promise<ScrapeResult> => {
  const domain = normalizeDomain(args.domain)
  const urls = await discoverPages({ domain, firecrawlApiKey: args.firecrawlApiKey, maxPages: 20 })

  const pages: string[] = []

  for (const url of urls) {
    const content = args.firecrawlApiKey
      ? await fetchViaFirecrawl(url, args.firecrawlApiKey)
      : await fetchPlainText(url)

    if (content) {
      pages.push(`# ${url}\n${content}`)
    }
  }

  const combined = truncate(pages.join('\n\n'), 70_000)
  const description = truncate(combined, 800)

  return {
    description,
    combinedContent: combined,
    pages: urls,
  }
}
