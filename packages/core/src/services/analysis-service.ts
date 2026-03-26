import { and, desc, eq, inArray } from 'drizzle-orm'
import OpenAI from 'openai'
import { analysisOutputSchema, type AnalysisOutput } from '../analysis/schema.js'
import { analysisResults, providerResponses, queries, runs } from '../db/schema.js'
import { buildAliases, findBrandMentions, type BrandMatchResult } from '../utils/brand-matching.js'
import { idWithPrefix, nowEpochMs } from '../utils/id.js'
import { safeJsonParse, stripCodeFences } from '../utils/json.js'
import { normalizeDomain } from '../utils/domain.js'
import { tokenCostUsd } from '../utils/cost.js'
import { computeAndStoreRunMetrics } from './runs/compute-metrics.js'
import type { AEOContext } from '../context.js'
import type { AnalysisInput, AnalyzeSummary } from '../types/index.js'

interface SourceHit {
  domainCitedAsSource: boolean
  sourcePosition: number | null
}

export const sourceCitationHint = (domain: string, sourcesJson: string | null): SourceHit => {
  if (!sourcesJson) {
    return {
      domainCitedAsSource: false,
      sourcePosition: null,
    }
  }

  const sources = safeJsonParse<Array<{ url?: string; domain?: string }>>(sourcesJson, [])
  const normalizedDomain = normalizeDomain(domain)
  const index = sources.findIndex((source) => {
    const sourceDomain = source.domain ?? (source.url ? normalizeDomain(new URL(source.url).hostname) : '')
    return normalizeDomain(sourceDomain) === normalizedDomain
  })

  return {
    domainCitedAsSource: index >= 0,
    sourcePosition: index >= 0 ? index + 1 : null,
  }
}

const buildPrompt = (args: {
  companyName: string
  domain: string
  aliases: string[]
  competitors: Array<{ domain: string; name: string }>
  query: string
  responseText: string
  sourceHint: SourceHit
  brandMatch: BrandMatchResult
}) => {
  return `You are analyzing an AI assistant's response to determine if a specific company was mentioned, how prominently, and how it compared to competitors.

Company to analyze:
- Domain: ${args.domain}
- Name: ${args.companyName}
- Also known as / related terms: ${args.aliases.join(', ') || 'none'}

Competitors to track:
${JSON.stringify(args.competitors)}

Query that was asked:
"${args.query}"

AI response to analyze:
---
${args.responseText}
---

Deterministic source citation pre-check hint:
${JSON.stringify(args.sourceHint)}

Deterministic brand-string pre-check:
${JSON.stringify(args.brandMatch)}
NOTE: If the pre-check found the brand string in the text (found=true), the company IS mentioned — your "mentioned" field MUST be true. Focus on characterizing the mention (type, prominence, sentiment).

Return ONLY a valid JSON object matching this exact schema. No explanation, no markdown, just JSON:

{
  "mentioned": boolean,
  "mention_type": "direct_name" | "domain_cited" | "product_named" | "indirect" | null,
  "total_mentions": number,
  "first_mention_sentence": number | null,
  "prominence_score": number,
  "mention_context": "primary_recommendation" | "top_of_list" | "listed" | "passing_mention" | "not_mentioned",
  "list_position": number | null,
  "recommended_as_best": boolean,
  "domain_cited_as_source": boolean,
  "source_position": number | null,
  "competitors_mentioned": [{"domain": string, "name": string}],
  "our_rank_vs_competitors": number | null,
  "ranked_above": [string],
  "ranked_below": [string],
  "sentiment": "positive" | "neutral" | "negative" | "not_mentioned",
  "sentiment_score": number,
  "sentiment_note": string,
  "response_type": "direct_answer" | "ranked_list" | "comparison" | "tutorial" | "other",
  "relevant_excerpt": string
}`
}

const parseAnalysis = (payload: string): AnalysisOutput => {
  const parsed = safeJsonParse<unknown>(stripCodeFences(payload), {})
  return analysisOutputSchema.parse(parsed)
}

const defaultAnalysisOutput = (sourceHint: SourceHit, brandMatch: BrandMatchResult, note: string): AnalysisOutput => ({
  mentioned: brandMatch.found,
  mention_type: brandMatch.found ? 'direct_name' : null,
  total_mentions: brandMatch.matchCount,
  first_mention_sentence: null,
  prominence_score: 0,
  mention_context: 'not_mentioned',
  list_position: null,
  recommended_as_best: false,
  domain_cited_as_source: sourceHint.domainCitedAsSource,
  source_position: sourceHint.sourcePosition,
  competitors_mentioned: [],
  our_rank_vs_competitors: null,
  ranked_above: [],
  ranked_below: [],
  sentiment: 'not_mentioned',
  sentiment_score: 0,
  sentiment_note: note.slice(0, 280),
  response_type: 'other',
  relevant_excerpt: '',
})

export class AnalysisService {
  constructor(private readonly ctx: AEOContext) {}

  private latestRunId = async (): Promise<string> => {
    const latest = await this.ctx.sqliteDb.db.select().from(runs).orderBy(desc(runs.startedAt)).limit(1)
    if (!latest[0]) {
      throw new Error('No runs found to analyze.')
    }

    return latest[0].id
  }

  analyze = async (input: AnalysisInput = {}): Promise<AnalyzeSummary> => {
    const runId = input.runId ?? (await this.latestRunId())
    const model = input.model ?? this.ctx.config.analysis.model
    const analysisProvider = this.ctx.config.analysis.provider

    if (analysisProvider !== 'openai') {
      throw new Error(`Analysis provider '${analysisProvider}' is not implemented yet.`)
    }

    const apiKey = process.env.GOOSE_AEO_OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('Missing GOOSE_AEO_OPENAI_API_KEY for analysis.')
    }

    const openai = new OpenAI({ apiKey })

    if (input.reanalyze) {
      await this.ctx.sqliteDb.db.delete(analysisResults).where(eq(analysisResults.runId, runId))
    }

    const responses = await this.ctx.sqliteDb.db
      .select()
      .from(providerResponses)
      .where(eq(providerResponses.runId, runId))

    if (responses.length === 0) {
      throw new Error(`No provider responses found for run ${runId}`)
    }

    const queryIds = Array.from(new Set(responses.map((response) => response.queryId)))
    const queryRows = await this.ctx.sqliteDb.db
      .select({ id: queries.id, text: queries.text })
      .from(queries)
      .where(inArray(queries.id, queryIds))

    const queryMap = new Map(queryRows.map((queryRow) => [queryRow.id, queryRow.text]))

    const existing = await this.ctx.sqliteDb.db
      .select({ responseId: analysisResults.responseId })
      .from(analysisResults)
      .where(eq(analysisResults.runId, runId))

    const existingResponseIds = new Set(existing.map((row) => row.responseId))
    const toAnalyze = input.reanalyze
      ? responses
      : responses.filter((response) => !existingResponseIds.has(response.id))

    let inserted = 0
    let skipped = responses.length - toAnalyze.length
    let failed = 0
    let analysisCostUsd = 0

    const aliases = buildAliases(
      this.ctx.config.name,
      this.ctx.config.domain,
      this.ctx.config.aliases,
    )

    for (const response of toAnalyze) {
      const sourceHint = sourceCitationHint(this.ctx.config.domain, response.sources)
      const brandMatch = findBrandMentions(response.rawResponse, aliases)
      const queryText = queryMap.get(response.queryId) ?? ''

      const prompt = buildPrompt({
        companyName: this.ctx.config.name,
        domain: this.ctx.config.domain,
        aliases,
        competitors: this.ctx.config.competitors.map((competitor) => ({
          domain: competitor.domain,
          name: competitor.name ?? competitor.domain,
        })),
        query: queryText,
        responseText: response.rawResponse,
        sourceHint,
        brandMatch,
      })

      let parsed: AnalysisOutput
      let usageInput = 0
      let usageOutput = 0

      try {
        const first = await openai.chat.completions.create({
          model,
          temperature: 0,
          max_completion_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        })

        usageInput = first.usage?.prompt_tokens ?? 0
        usageOutput = first.usage?.completion_tokens ?? 0
        parsed = parseAnalysis(first.choices[0]?.message?.content ?? '{}')
      } catch (firstError) {
        try {
          const retry = await openai.chat.completions.create({
            model,
            temperature: 0.2,
            max_completion_tokens: 1200,
            messages: [{ role: 'user', content: `${prompt}\n\nReturn ONLY valid JSON.` }],
          })

          usageInput = retry.usage?.prompt_tokens ?? 0
          usageOutput = retry.usage?.completion_tokens ?? 0
          parsed = parseAnalysis(retry.choices[0]?.message?.content ?? '{}')
        } catch (retryError) {
          failed += 1
          const note = retryError instanceof Error ? retryError.message : String(retryError)
          parsed = defaultAnalysisOutput(sourceHint, brandMatch, note)
        }
      }

      // Phase 3: Post-LLM verification & override
      if (brandMatch.found && !parsed.mentioned) {
        parsed = {
          ...parsed,
          mentioned: true,
          mention_type: parsed.mention_type ?? 'direct_name',
          mention_context: parsed.mention_context === 'not_mentioned' ? 'passing_mention' : parsed.mention_context,
          total_mentions: Math.max(parsed.total_mentions, brandMatch.matchCount),
          sentiment: parsed.sentiment === 'not_mentioned' ? 'neutral' : parsed.sentiment,
        }
      }

      if (!brandMatch.found && parsed.mentioned && parsed.mention_type !== 'indirect') {
        parsed = { ...parsed, mention_type: 'indirect' }
      }

      const analysisCost = tokenCostUsd(usageInput, usageOutput, {
        costPer1kInputTokens: this.ctx.pricing.analysis.costPer1kInputTokens,
        costPer1kOutputTokens: this.ctx.pricing.analysis.costPer1kOutputTokens,
      })

      analysisCostUsd += analysisCost

      await this.ctx.sqliteDb.db.insert(analysisResults).values({
        id: idWithPrefix('analysis'),
        responseId: response.id,
        runId,
        queryId: response.queryId,
        provider: response.provider,
        mentioned: parsed.mentioned ? 1 : 0,
        mentionType: parsed.mention_type,
        totalMentions: parsed.total_mentions,
        firstMentionSentence: parsed.first_mention_sentence,
        prominenceScore: parsed.prominence_score,
        mentionContext: parsed.mention_context,
        listPosition: parsed.list_position,
        recommendedAsBest: parsed.recommended_as_best ? 1 : 0,
        domainCitedAsSource: parsed.domain_cited_as_source ? 1 : 0,
        sourcePosition: parsed.source_position,
        competitorsMentioned: JSON.stringify(parsed.competitors_mentioned),
        ourRankVsCompetitors: parsed.our_rank_vs_competitors,
        rankedAbove: JSON.stringify(parsed.ranked_above),
        rankedBelow: JSON.stringify(parsed.ranked_below),
        sentiment: parsed.sentiment,
        sentimentScore: parsed.sentiment_score,
        sentimentNote: parsed.sentiment_note,
        responseType: parsed.response_type,
        relevantExcerpt: parsed.relevant_excerpt,
        analysisModel: model,
        analysisInputTokens: usageInput,
        analysisOutputTokens: usageOutput,
        analysisCostUsd: analysisCost,
        createdAt: nowEpochMs(),
      })

      inserted += 1
    }

    const runRow = await this.ctx.sqliteDb.db.select().from(runs).where(eq(runs.id, runId)).limit(1)
    const existingActual = runRow[0]?.actualCost ?? 0

    await this.ctx.sqliteDb.db
      .update(runs)
      .set({ actualCost: existingActual + analysisCostUsd })
      .where(eq(runs.id, runId))

    await computeAndStoreRunMetrics(this.ctx, runId)

    return {
      runId,
      responsesAnalyzed: responses.length,
      inserted,
      skipped,
      failed,
      analysisCostUsd,
    }
  }
}
