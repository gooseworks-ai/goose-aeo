import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'
import { and, eq } from 'drizzle-orm'
import { makeDefaultConfig, saveConfig } from '../config/load-config.js'
import { DEFAULT_PRICING } from '../config/pricing.js'
import { createSqliteDb } from '../db/client.js'
import { companies, competitors } from '../db/schema.js'
import { defaultProviderModels } from '../config/schema.js'
import { idWithPrefix, nowEpochMs } from '../utils/id.js'
import { normalizeDomain } from '../utils/domain.js'
import { safeJsonParse, stripCodeFences } from '../utils/json.js'
import { scrapeDomainContent } from './queries/scrape.js'
import type { CompetitorConfig, GooseAEOConfig, ProviderId } from '../types/index.js'

export interface InitOptions {
  cwd: string
  configPath?: string
  domain: string
  name?: string
  description?: string
  providers?: ProviderId[]
  queryLimit?: number
  dbPath?: string
  competitors?: CompetitorConfig[]
  analysisProvider?: ProviderId
  analysisModel?: string
  budgetLimitUsd?: number | null
}

export interface InitResult {
  configPath: string
  dbPath: string
  pricingPath: string
  domain: string
  name: string
  description?: string
  competitors: CompetitorConfig[]
  providers: Array<{ id: ProviderId; model: string }>
  queryLimit: number
}

const suggestCompetitors = async (args: {
  content: string
  domain: string
  apiKey?: string
}): Promise<CompetitorConfig[]> => {
  if (!args.apiKey) {
    return []
  }

  const openai = new OpenAI({ apiKey: args.apiKey })
  const prompt = `You are helping identify software competitors from company website text.

Company domain: ${args.domain}

Website content:
---
${args.content}
---

Return only a JSON array of up to 5 objects with shape {"domain": string, "name": string}.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_completion_tokens: 800,
  })

  const text = completion.choices[0]?.message?.content ?? '[]'
  const parsed = safeJsonParse<Array<{ domain?: string; name?: string }>>(stripCodeFences(text), [])

  return parsed
    .map((entry) => ({
      domain: normalizeDomain(entry.domain ?? ''),
      name: entry.name,
    }))
    .filter((entry) => Boolean(entry.domain) && entry.domain !== normalizeDomain(args.domain))
    .slice(0, 5)
}

export const bootstrapDomainContext = async (args: {
  domain: string
  firecrawlApiKey?: string
  openAiApiKey?: string
}) => {
  const scrape = await scrapeDomainContent({
    domain: args.domain,
    firecrawlApiKey: args.firecrawlApiKey,
  })

  const competitors = await suggestCompetitors({
    content: scrape.combinedContent,
    domain: args.domain,
    apiKey: args.openAiApiKey,
  })

  return {
    description: scrape.description,
    competitors,
  }
}

export const initProject = async (options: InitOptions): Promise<InitResult> => {
  const domain = normalizeDomain(options.domain)
  const base = makeDefaultConfig(domain, options.name)

  const config: GooseAEOConfig = {
    ...base,
    description: options.description ?? base.description,
    providers:
      options.providers && options.providers.length > 0
        ? options.providers.map((providerId) => ({
            id: providerId,
            model: defaultProviderModels[providerId],
          }))
        : base.providers,
    queryLimit: options.queryLimit ?? base.queryLimit,
    dbPath: options.dbPath ?? base.dbPath,
    competitors: options.competitors ?? base.competitors,
    analysis: {
      provider: options.analysisProvider ?? base.analysis.provider,
      model: options.analysisModel ?? base.analysis.model,
    },
    budgetLimitUsd: options.budgetLimitUsd ?? base.budgetLimitUsd,
  }

  const configPath = saveConfig(options.cwd, config, options.configPath)
  const pricingPath = path.resolve(options.cwd, 'pricing.json')
  if (!existsSync(pricingPath)) {
    writeFileSync(pricingPath, JSON.stringify(DEFAULT_PRICING, null, 2) + '\n', 'utf8')
  }
  const dbPath = path.resolve(options.cwd, config.dbPath)
  const sqliteDb = await createSqliteDb(dbPath)
  const timestamp = nowEpochMs()

  const companyConfigSnapshot = JSON.stringify({
    providers: config.providers,
    query_limit: config.queryLimit,
    analysis: config.analysis,
  })

  const companyId = 'company_default'

  const existing = await sqliteDb.db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))

  if (existing.length === 0) {
    await sqliteDb.db.insert(companies).values({
      id: companyId,
      domain,
      name: config.name,
      description: config.description,
      config: companyConfigSnapshot,
      createdAt: timestamp,
    })
  } else {
    await sqliteDb.db
      .update(companies)
      .set({
        domain,
        name: config.name,
        description: config.description,
        config: companyConfigSnapshot,
      })
      .where(eq(companies.id, companyId))

    await sqliteDb.db.delete(competitors).where(eq(competitors.companyId, companyId))
  }

  if (config.competitors.length > 0) {
    await sqliteDb.db.insert(competitors).values(
      config.competitors.map((competitor) => ({
        id: idWithPrefix('comp'),
        companyId,
        domain: normalizeDomain(competitor.domain),
        name: competitor.name,
        createdAt: timestamp,
      })),
    )
  }

  sqliteDb.close()

  return {
    configPath,
    dbPath,
    pricingPath,
    domain,
    name: config.name,
    description: config.description,
    competitors: config.competitors,
    providers: config.providers,
    queryLimit: config.queryLimit,
  }
}
