export interface BrandMatchResult {
  found: boolean
  matchedTerms: string[]
  matchCount: number
  firstMatchIndex: number | null
}

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isDomainLike = (alias: string): boolean => alias.includes('.')

export const buildAliases = (name: string, domain: string, extraAliases?: string[]): string[] => {
  const raw: string[] = [name]

  const domainWithoutTld = domain.split('.')[0] ?? ''
  if (domainWithoutTld) {
    raw.push(domainWithoutTld)
  }

  raw.push(domain)

  if (extraAliases) {
    raw.push(...extraAliases)
  }

  const seen = new Set<string>()
  const result: string[] = []

  for (const alias of raw) {
    const trimmed = alias.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }

  return result
}

export const findBrandMentions = (text: string, aliases: string[]): BrandMatchResult => {
  const matchedTerms: string[] = []
  let totalCount = 0
  let firstIndex: number | null = null

  for (const alias of aliases) {
    let pattern: RegExp

    if (isDomainLike(alias)) {
      // Domain-format: literal case-insensitive match (dots provide natural boundaries)
      pattern = new RegExp(escapeRegex(alias), 'gi')
    } else if (alias.length <= 3) {
      // Short names: case-sensitive with word boundaries
      pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'g')
    } else {
      // Medium+ names: case-insensitive with word boundaries
      pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'gi')
    }

    const matches = text.matchAll(pattern)
    let aliasCount = 0

    for (const match of matches) {
      aliasCount++
      if (firstIndex === null || (match.index !== undefined && match.index < firstIndex)) {
        firstIndex = match.index ?? null
      }
    }

    if (aliasCount > 0) {
      matchedTerms.push(alias)
      totalCount += aliasCount
    }
  }

  return {
    found: totalCount > 0,
    matchedTerms,
    matchCount: totalCount,
    firstMatchIndex: firstIndex,
  }
}
