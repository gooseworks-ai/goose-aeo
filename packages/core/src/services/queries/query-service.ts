import { and, desc, eq, isNull, max } from 'drizzle-orm'
import OpenAI from 'openai'
import { queries } from '../../db/schema.js'
import { idWithPrefix, nowEpochMs } from '../../utils/id.js'
import { safeJsonParse, stripCodeFences } from '../../utils/json.js'
import { scrapeDomainContent } from './scrape.js'
import type { AEOContext } from '../../context.js'

const fallbackQueries = (domain: string, limit: number): string[] => {
  const topics = [
    'best tools for',
    'how do I',
    'alternatives to',
    'comparison between',
    'what should I look for in',
    'top platforms for',
    'how to evaluate',
    'recommended software for',
  ]

  const intents = [
    'LLM observability',
    'AI evaluation',
    'prompt testing',
    'agent reliability',
    'AI monitoring',
    'LLM analytics',
    'AI quality assurance',
    'model benchmarking',
  ]

  const generated: string[] = []
  for (const topic of topics) {
    for (const intent of intents) {
      generated.push(`${topic} ${intent}`)
      if (generated.length >= limit) {
        return generated
      }
    }
  }

  if (generated.length < limit) {
    generated.push(`how to choose a platform like ${domain}`)
  }

  return generated.slice(0, limit)
}

const generateQueriesWithLlm = async (args: {
  scrapedContent: string
  competitors: string[]
  limit: number
  model: string
  apiKey?: string
  domain: string
}): Promise<string[]> => {
  if (!args.apiKey) {
    return fallbackQueries(args.domain, args.limit)
  }

  const openai = new OpenAI({ apiKey: args.apiKey })
  const prompt = `You are an expert in SEO and answer engine optimization (AEO).

Given the following company description scraped from their website, generate ${args.limit} distinct search queries that:
1. A potential customer would ask an AI assistant (ChatGPT, Perplexity, Gemini, etc.) when looking for a product like this
2. Cover a range of intents: problem-aware ("how do I..."), solution-aware ("best tools for..."), comparison ("X vs Y"), and evaluation ("what should I look for in...")
3. Are phrased naturally — exactly as a user would type them — not marketing language
4. Do NOT mention the company name or domain explicitly

Company website content:
---
${args.scrapedContent}
---

Competitors (also do NOT mention these explicitly in queries):
${args.competitors.join(', ') || 'none'}

Return a JSON array of exactly ${args.limit} query strings. No explanations, no numbering, just the array.`

  const completion = await openai.chat.completions.create({
    model: args.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 2000,
  })

  const content = completion.choices[0]?.message?.content ?? '[]'
  const parsed = safeJsonParse<string[]>(stripCodeFences(content), [])

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return fallbackQueries(args.domain, args.limit)
  }

  const unique = Array.from(new Set(parsed.map((item) => item.trim()).filter(Boolean)))
  if (unique.length >= args.limit) {
    return unique.slice(0, args.limit)
  }

  const fill = fallbackQueries(args.domain, args.limit)
  return Array.from(new Set([...unique, ...fill])).slice(0, args.limit)
}

export class QueryService {
  constructor(private readonly ctx: AEOContext) {}

  listActive = async () => {
    return this.ctx.sqliteDb.db
      .select()
      .from(queries)
      .where(and(eq(queries.companyId, 'company_default'), isNull(queries.deprecatedAt)))
      .orderBy(desc(queries.createdAt))
  }

  add = async (text: string) => {
    const versionRows = await this.ctx.sqliteDb.db
      .select({ maxVersion: max(queries.version) })
      .from(queries)
      .where(eq(queries.companyId, 'company_default'))

    const version = versionRows[0]?.maxVersion ?? 1
    const id = idWithPrefix('q')

    await this.ctx.sqliteDb.db.insert(queries).values({
      id,
      companyId: 'company_default',
      text,
      version,
      createdAt: nowEpochMs(),
      deprecatedAt: null,
    })

    return { id, text, version }
  }

  remove = async (id: string): Promise<boolean> => {
    const existing = await this.ctx.sqliteDb.db
      .select({ id: queries.id })
      .from(queries)
      .where(and(eq(queries.id, id), eq(queries.companyId, 'company_default'), isNull(queries.deprecatedAt)))

    if (existing.length === 0) {
      return false
    }

    await this.ctx.sqliteDb.db
      .update(queries)
      .set({ deprecatedAt: nowEpochMs() })
      .where(and(eq(queries.id, id), eq(queries.companyId, 'company_default'), isNull(queries.deprecatedAt)))

    return true
  }

  generate = async (args: { limit?: number; model?: string; dryRun?: boolean }) => {
    const limit = Math.min(500, Math.max(1, args.limit ?? this.ctx.config.queryLimit))
    const firecrawlApiKey = process.env.GOOSE_AEO_FIRECRAWL_API_KEY
    const scrape = await scrapeDomainContent({
      domain: this.ctx.config.domain,
      firecrawlApiKey,
    })

    const generationModel = args.model ?? this.ctx.config.analysis.model
    const generatedQueries = await generateQueriesWithLlm({
      scrapedContent: scrape.combinedContent,
      competitors: this.ctx.config.competitors.map((competitor) => competitor.domain),
      limit,
      model: generationModel,
      apiKey: process.env.GOOSE_AEO_OPENAI_API_KEY,
      domain: this.ctx.config.domain,
    })

    if (args.dryRun) {
      return {
        saved: false,
        version: null,
        queries: generatedQueries,
      }
    }

    const [currentVersionRow] = await this.ctx.sqliteDb.db
      .select({ maxVersion: max(queries.version) })
      .from(queries)
      .where(eq(queries.companyId, 'company_default'))

    const nextVersion = (currentVersionRow?.maxVersion ?? 0) + 1
    const timestamp = nowEpochMs()

    await this.ctx.sqliteDb.db
      .update(queries)
      .set({ deprecatedAt: timestamp })
      .where(and(eq(queries.companyId, 'company_default'), isNull(queries.deprecatedAt)))

    if (generatedQueries.length > 0) {
      await this.ctx.sqliteDb.db.insert(queries).values(
        generatedQueries.map((query) => ({
          id: idWithPrefix('q'),
          companyId: 'company_default',
          text: query,
          version: nextVersion,
          createdAt: timestamp,
          deprecatedAt: null,
        })),
      )
    }

    return {
      saved: true,
      version: nextVersion,
      queries: generatedQueries,
    }
  }
}
