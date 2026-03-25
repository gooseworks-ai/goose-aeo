import { desc, eq } from 'drizzle-orm'
import OpenAI from 'openai'
import { analysisResults, providerResponses, queries, recommendations, runs } from '../../db/schema.js'
import { idWithPrefix, nowEpochMs } from '../../utils/id.js'
import { safeJsonParse, stripCodeFences } from '../../utils/json.js'
import { tokenCostUsd } from '../../utils/cost.js'
import { recommendationResponseSchema } from './schema.js'
import type { AEOContext } from '../../context.js'
import type { RecommendationResult } from '../../types/index.js'

export class RecommendationService {
  constructor(private readonly ctx: AEOContext) {}

  generate = async (runId?: string): Promise<RecommendationResult> => {
    // 1. Resolve latest run if no runId provided
    const resolvedRunId = runId ?? (await this.latestRunId())

    // 2. Query all analysis results for the run, joined with queries and provider responses
    const rows = await this.ctx.sqliteDb.db
      .select({
        analysisId: analysisResults.id,
        queryId: analysisResults.queryId,
        queryText: queries.text,
        provider: analysisResults.provider,
        mentioned: analysisResults.mentioned,
        competitorsMentioned: analysisResults.competitorsMentioned,
        relevantExcerpt: analysisResults.relevantExcerpt,
        responseId: analysisResults.responseId,
        sources: providerResponses.sources,
      })
      .from(analysisResults)
      .innerJoin(queries, eq(queries.id, analysisResults.queryId))
      .innerJoin(providerResponses, eq(providerResponses.id, analysisResults.responseId))
      .where(eq(analysisResults.runId, resolvedRunId))

    // 3. Aggregate data in code

    // Visibility gaps: entries where mentioned = 0
    const gapsByQuery = new Map<string, {
      queryText: string
      sources: Set<string>
      competitors: Set<string>
    }>()

    // Source opportunities: count domain frequency across all responses
    const domainCounts = new Map<string, { count: number; queryTexts: Set<string> }>()

    // Competitor insights: entries where mentioned = 0 AND competitorsMentioned is non-empty
    const competitorMap = new Map<string, {
      domain: string
      queryTexts: Set<string>
      excerpts: Set<string>
    }>()

    for (const row of rows) {
      // Parse sources
      const sourcesArr = safeJsonParse<Array<{ url?: string; domain?: string }>>(row.sources ?? '[]', [])
      const sourceDomains: string[] = []
      for (const source of sourcesArr) {
        let domain: string | null = null
        if (source.domain) {
          domain = source.domain
        } else if (source.url) {
          try {
            domain = new URL(source.url).hostname.replace(/^www\./, '')
          } catch {
            // skip
          }
        }
        if (domain) {
          sourceDomains.push(domain)
          const existing = domainCounts.get(domain)
          if (existing) {
            existing.count++
            existing.queryTexts.add(row.queryText)
          } else {
            domainCounts.set(domain, { count: 1, queryTexts: new Set([row.queryText]) })
          }
        }
      }

      // Parse competitors
      const competitorsList = safeJsonParse<Array<{ domain?: string; name?: string }>>(
        row.competitorsMentioned ?? '[]',
        [],
      )

      // Visibility gaps
      if (row.mentioned === 0) {
        const existing = gapsByQuery.get(row.queryText)
        if (existing) {
          for (const d of sourceDomains) existing.sources.add(d)
          for (const c of competitorsList) existing.competitors.add(c.name ?? c.domain ?? 'unknown')
        } else {
          gapsByQuery.set(row.queryText, {
            queryText: row.queryText,
            sources: new Set(sourceDomains),
            competitors: new Set(competitorsList.map((c) => c.name ?? c.domain ?? 'unknown')),
          })
        }

        // Competitor insights (not mentioned but competitors are)
        for (const comp of competitorsList) {
          const compName = comp.name ?? comp.domain ?? 'unknown'
          const compDomain = comp.domain ?? 'unknown'
          const existing = competitorMap.get(compName)
          if (existing) {
            existing.queryTexts.add(row.queryText)
            if (row.relevantExcerpt) existing.excerpts.add(row.relevantExcerpt)
          } else {
            competitorMap.set(compName, {
              domain: compDomain,
              queryTexts: new Set([row.queryText]),
              excerpts: new Set(row.relevantExcerpt ? [row.relevantExcerpt] : []),
            })
          }
        }
      }
    }

    // Build aggregated data for the prompt
    const visibilityGapsData = Array.from(gapsByQuery.entries()).map(([queryText, data]) => ({
      query: queryText,
      citedSources: Array.from(data.sources).slice(0, 10),
      mentionedCompetitors: Array.from(data.competitors),
    }))

    const topDomains = Array.from(domainCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([domain, data]) => ({
        domain,
        citationCount: data.count,
        queryContexts: Array.from(data.queryTexts).slice(0, 5),
      }))

    const competitorInsightsData = Array.from(competitorMap.entries()).map(([name, data]) => ({
      competitor: name,
      domain: data.domain,
      queriesWhereTheyAppear: Array.from(data.queryTexts),
      excerpts: Array.from(data.excerpts).slice(0, 5),
    }))

    // 4. Make ONE OpenAI call
    const apiKey = process.env.GOOSE_AEO_OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('GOOSE_AEO_OPENAI_API_KEY is required for recommendations')
    }

    const model = this.ctx.config.analysis.model ?? 'gpt-5.4-mini'
    const companyName = this.ctx.config.name
    const companyDomain = this.ctx.config.domain

    const prompt = `You are an AI visibility strategist. Analyze the following data about "${companyName}" (${companyDomain}) and generate actionable recommendations.

## Visibility Gaps
These are queries where ${companyName} was NOT mentioned by AI search engines:
${JSON.stringify(visibilityGapsData, null, 2)}

## Top Cited Sources
These are the most frequently cited domains across all provider responses:
${JSON.stringify(topDomains, null, 2)}

## Competitor Insights
These are competitors that WERE mentioned when ${companyName} was NOT:
${JSON.stringify(competitorInsightsData, null, 2)}

## Instructions
1. Synthesize the visibility gaps into 3-5 themed recommendations. Group similar queries into topics.
2. For each top source opportunity, write a specific action item for how ${companyName} could get cited by or featured on that source.
3. For each competitor insight, explain what they might be doing differently that leads to AI mentions.
4. Write an overall summary paragraph (2-3 sentences) about ${companyName}'s current AI visibility position and top priorities.

Return ONLY valid JSON matching this exact structure:
{
  "visibilityGaps": [{ "topic": string, "queries": [string], "citedSources": [string], "mentionedCompetitors": [string], "recommendation": string }],
  "sourceOpportunities": [{ "domain": string, "citationCount": number, "queryContexts": [string], "recommendation": string }],
  "competitorInsights": [{ "competitor": string, "domain": string, "queriesWhereTheyAppear": [string], "excerpts": [string], "recommendation": string }],
  "summary": string
}`

    const openai = new OpenAI({ apiKey })

    let parsed: ReturnType<typeof recommendationResponseSchema.parse> | null = null
    let totalInputTokens = 0
    let totalOutputTokens = 0

    for (const temperature of [0, 0.2]) {
      const response = await openai.chat.completions.create({
        model,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      })

      const choice = response.choices[0]
      const content = choice?.message?.content ?? ''
      totalInputTokens += response.usage?.prompt_tokens ?? 0
      totalOutputTokens += response.usage?.completion_tokens ?? 0

      try {
        const cleaned = stripCodeFences(content)
        const json = JSON.parse(cleaned)
        parsed = recommendationResponseSchema.parse(json)
        break
      } catch {
        if (temperature >= 0.2) {
          throw new Error('Failed to parse recommendation response from LLM after retry')
        }
        // retry with higher temperature
      }
    }

    if (!parsed) {
      throw new Error('Failed to generate recommendations')
    }

    // 5. Calculate cost
    const analysisPricing = this.ctx.pricing.analysis
    const costUsd = tokenCostUsd(totalInputTokens, totalOutputTokens, analysisPricing)

    // 6. Store in recommendations table
    const id = idWithPrefix('rec')
    const now = nowEpochMs()

    await this.ctx.sqliteDb.db.insert(recommendations).values({
      id,
      runId: resolvedRunId,
      companyId: 'company_default',
      visibilityGaps: JSON.stringify(parsed.visibilityGaps),
      sourceOpportunities: JSON.stringify(parsed.sourceOpportunities),
      competitorInsights: JSON.stringify(parsed.competitorInsights),
      summary: parsed.summary,
      model,
      costUsd,
      createdAt: now,
    })

    // 7. Return result
    return {
      id,
      runId: resolvedRunId,
      visibilityGaps: parsed.visibilityGaps,
      sourceOpportunities: parsed.sourceOpportunities,
      competitorInsights: parsed.competitorInsights,
      summary: parsed.summary,
      model,
      costUsd,
      createdAt: new Date(now).toISOString(),
    }
  }

  private latestRunId = async (): Promise<string> => {
    const latest = await this.ctx.sqliteDb.db
      .select()
      .from(runs)
      .orderBy(desc(runs.startedAt))
      .limit(1)

    if (!latest[0]) {
      throw new Error('No runs found. Run an analysis first.')
    }

    return latest[0].id
  }
}
