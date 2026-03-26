import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { analysisResults, audits, competitors as competitorsTable, companies, providerResponses, queries, recommendations, runMetrics, runs } from '../../db/schema.js'
import { safeJsonParse } from '../../utils/json.js'
import type { AEOContext } from '../../context.js'
import type { DashboardResultRecord, DashboardRunRecord, ProviderId, Source } from '../../types/index.js'

export class DashboardService {
  constructor(private readonly ctx: AEOContext) {}

  getRuns = async (args: { limit?: number; offset?: number } = {}) => {
    const limit = Math.max(1, Math.min(200, args.limit ?? 20))
    const offset = Math.max(0, args.offset ?? 0)

    const rows = await this.ctx.sqliteDb.db
      .select()
      .from(runs)
      .orderBy(desc(runs.startedAt))
      .limit(limit)
      .offset(offset)

    const records: DashboardRunRecord[] = rows.map((row) => ({
      id: row.id,
      status: row.status as DashboardRunRecord['status'],
      startedAt: new Date(row.startedAt).toISOString(),
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      estimatedCostUsd: row.estimatedCost,
      actualCostUsd: row.actualCost,
      queryVersion: row.queryVersion,
      error: row.error,
    }))

    return records
  }

  getRun = async (runId: string) => {
    const [row] = await this.ctx.sqliteDb.db.select().from(runs).where(eq(runs.id, runId)).limit(1)
    if (!row) {
      return null
    }

    return {
      id: row.id,
      companyId: row.companyId,
      status: row.status,
      configSnapshot: safeJsonParse<Record<string, unknown>>(row.configSnapshot, {}),
      queryVersion: row.queryVersion,
      estimatedCostUsd: row.estimatedCost,
      actualCostUsd: row.actualCost,
      startedAt: new Date(row.startedAt).toISOString(),
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      error: row.error,
    }
  }

  getRunMetrics = async (runId: string) => {
    const rows = await this.ctx.sqliteDb.db
      .select({
        provider: runMetrics.provider,
        metric: runMetrics.metric,
        value: runMetrics.value,
      })
      .from(runMetrics)
      .where(eq(runMetrics.runId, runId))

    const grouped = new Map<string, Record<string, number>>()
    for (const row of rows) {
      const key = row.provider ?? 'all'
      const metrics = grouped.get(key) ?? {}
      metrics[row.metric] = row.value
      grouped.set(key, metrics)
    }

    return Array.from(grouped.entries()).map(([provider, metrics]) => ({
      provider: provider === 'all' ? null : (provider as ProviderId),
      metrics,
    }))
  }

  getRunResults = async (args: {
    runId: string
    provider?: string
    queryId?: string
    limit?: number
    offset?: number
  }): Promise<DashboardResultRecord[]> => {
    const limit = Math.max(1, Math.min(500, args.limit ?? 100))
    const offset = Math.max(0, args.offset ?? 0)

    const conditions = [eq(providerResponses.runId, args.runId)]
    if (args.provider) {
      conditions.push(eq(providerResponses.provider, args.provider))
    }
    if (args.queryId) {
      conditions.push(eq(providerResponses.queryId, args.queryId))
    }

    const rows = await this.ctx.sqliteDb.db
      .select({
        responseId: providerResponses.id,
        queryId: providerResponses.queryId,
        query: queries.text,
        provider: providerResponses.provider,
        model: providerResponses.model,
        rawResponse: providerResponses.rawResponse,
        sources: providerResponses.sources,
        costUsd: providerResponses.costUsd,
        createdAt: providerResponses.createdAt,
        mentioned: analysisResults.mentioned,
        prominenceScore: analysisResults.prominenceScore,
        sentiment: analysisResults.sentiment,
        sentimentScore: analysisResults.sentimentScore,
        relevantExcerpt: analysisResults.relevantExcerpt,
      })
      .from(providerResponses)
      .leftJoin(queries, eq(queries.id, providerResponses.queryId))
      .leftJoin(analysisResults, eq(analysisResults.responseId, providerResponses.id))
      .where(and(...conditions))
      .orderBy(desc(providerResponses.createdAt))
      .limit(limit)
      .offset(offset)

    return rows.map((row) => ({
      responseId: row.responseId,
      queryId: row.queryId,
      query: row.query ?? row.queryId,
      provider: row.provider as ProviderId,
      model: row.model,
      rawResponse: row.rawResponse,
      sources: safeJsonParse<Source[]>(row.sources ?? '[]', []),
      mentioned: row.mentioned === null ? null : row.mentioned === 1,
      prominenceScore: row.prominenceScore,
      sentiment: row.sentiment,
      sentimentScore: row.sentimentScore,
      relevantExcerpt: row.relevantExcerpt,
      costUsd: row.costUsd,
      createdAt: new Date(row.createdAt).toISOString(),
    }))
  }

  getQueries = async () => {
    return this.ctx.sqliteDb.db
      .select()
      .from(queries)
      .orderBy(desc(queries.createdAt))
  }

  getQueryVisibility = async () => {
    const rows = await this.ctx.sqliteDb.db
      .select({
        queryId: queries.id,
        query: queries.text,
        version: queries.version,
        deprecatedAt: queries.deprecatedAt,
        total: sql<number>`count(${analysisResults.id})`,
        mentioned: sql<number>`sum(case when ${analysisResults.mentioned} = 1 then 1 else 0 end)`,
      })
      .from(queries)
      .leftJoin(analysisResults, eq(analysisResults.queryId, queries.id))
      .groupBy(queries.id)

    return rows.map((row) => ({
      queryId: row.queryId,
      query: row.query,
      version: row.version,
      active: row.deprecatedAt === null,
      visibilityRate: row.total > 0 ? row.mentioned / row.total : 0,
    }))
  }

  getCompetitors = async (runId: string) => {
    // Get total responses for this run
    const totalRows = await this.ctx.sqliteDb.db
      .select({ count: sql<number>`count(*)` })
      .from(analysisResults)
      .where(eq(analysisResults.runId, runId))
    const totalResponses = totalRows[0]?.count ?? 0

    // Get configured competitors
    const configuredCompetitors = await this.ctx.sqliteDb.db
      .select()
      .from(competitorsTable)

    // Build competitor mention counts from analysis_results
    const rows = await this.ctx.sqliteDb.db
      .select({
        competitorsMentioned: analysisResults.competitorsMentioned,
      })
      .from(analysisResults)
      .where(eq(analysisResults.runId, runId))

    const mentionCounts = new Map<string, { domain: string; name: string | null; count: number }>()

    // Initialize from configured competitors
    for (const c of configuredCompetitors) {
      mentionCounts.set(c.domain, { domain: c.domain, name: c.name, count: 0 })
    }

    // Count mentions from analysis results
    for (const row of rows) {
      const competitors = safeJsonParse<Array<{ domain?: string; name?: string; mentioned?: boolean }>>(
        row.competitorsMentioned ?? '[]',
        [],
      )
      for (const comp of competitors) {
        const domain = comp.domain ?? 'unknown'
        const existing = mentionCounts.get(domain)
        if (existing) {
          if (comp.mentioned !== false) existing.count++
        } else {
          mentionCounts.set(domain, { domain, name: comp.name ?? null, count: comp.mentioned !== false ? 1 : 0 })
        }
      }
    }

    const competitorList = Array.from(mentionCounts.values())
      .map((c) => ({
        domain: c.domain,
        name: c.name,
        mentionCount: c.count,
        visibilityRate: totalResponses > 0 ? c.count / totalResponses : 0,
      }))
      .sort((a, b) => b.visibilityRate - a.visibilityRate)

    // Determine our rank
    const ourMentionedRows = await this.ctx.sqliteDb.db
      .select({ count: sql<number>`count(*)` })
      .from(analysisResults)
      .where(and(eq(analysisResults.runId, runId), eq(analysisResults.mentioned, 1)))
    const ourMentionCount = ourMentionedRows[0]?.count ?? 0
    const ourVisRate = totalResponses > 0 ? ourMentionCount / totalResponses : 0

    let ourRank: number | null = null
    const allRates = competitorList.map((c) => c.visibilityRate)
    allRates.push(ourVisRate)
    allRates.sort((a, b) => b - a)
    ourRank = allRates.indexOf(ourVisRate) + 1

    return {
      competitors: competitorList,
      ourRank,
      totalResponses,
    }
  }

  getCitations = async (runId: string) => {
    // Get company domain
    const [company] = await this.ctx.sqliteDb.db.select().from(companies).limit(1)
    const companyDomain = company?.domain ?? ''

    // Get configured competitor domains
    const configuredCompetitors = await this.ctx.sqliteDb.db.select().from(competitorsTable)
    const competitorDomains = new Set(configuredCompetitors.map((c) => c.domain))

    // Get all sources from provider responses for this run
    const rows = await this.ctx.sqliteDb.db
      .select({ sources: providerResponses.sources })
      .from(providerResponses)
      .where(eq(providerResponses.runId, runId))

    const domainCounts = new Map<string, number>()
    for (const row of rows) {
      const sources = safeJsonParse<Array<{ url?: string; domain?: string }>>(row.sources ?? '[]', [])
      for (const source of sources) {
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
          domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1)
        }
      }
    }

    let totalCitations = 0
    let ownDomainCitations = 0
    const domains = Array.from(domainCounts.entries())
      .map(([domain, count]) => {
        totalCitations += count
        const isOwnDomain = companyDomain !== '' && domain.includes(companyDomain.replace(/^www\./, ''))
        if (isOwnDomain) ownDomainCitations += count
        return {
          domain,
          mentionCount: count,
          isOwnDomain,
          isCompetitor: competitorDomains.has(domain),
        }
      })
      .sort((a, b) => b.mentionCount - a.mentionCount)

    return { domains, totalCitations, ownDomainCitations }
  }

  getTrends = async (metric: string, last: number) => {
    const recentRuns = await this.ctx.sqliteDb.db
      .select({ id: runs.id, startedAt: runs.startedAt })
      .from(runs)
      .where(eq(runs.status, 'completed'))
      .orderBy(desc(runs.startedAt))
      .limit(last)

    const points: Array<{ runId: string; date: string; value: number }> = []
    for (const run of recentRuns) {
      const [metricRow] = await this.ctx.sqliteDb.db
        .select({ value: runMetrics.value })
        .from(runMetrics)
        .where(
          and(
            eq(runMetrics.runId, run.id),
            eq(runMetrics.metric, metric),
            isNull(runMetrics.provider),
          ),
        )
        .limit(1)

      if (metricRow) {
        points.push({
          runId: run.id,
          date: new Date(run.startedAt).toISOString(),
          value: metricRow.value,
        })
      }
    }

    // Reverse to chronological order
    points.reverse()

    return {
      metric,
      provider: null,
      points,
    }
  }

  getAudits = async () => {
    const rows = await this.ctx.sqliteDb.db
      .select()
      .from(audits)
      .orderBy(desc(audits.createdAt))

    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      overallScore: row.overallScore,
      pages: safeJsonParse<unknown[]>(row.pages, []),
      recommendations: safeJsonParse<string[]>(row.recommendations, []),
      model: row.model,
      costUsd: row.costUsd,
      createdAt: new Date(row.createdAt).toISOString(),
    }))
  }

  getAudit = async (auditId: string) => {
    const [row] = await this.ctx.sqliteDb.db
      .select()
      .from(audits)
      .where(eq(audits.id, auditId))
      .limit(1)

    if (!row) return null

    return {
      id: row.id,
      companyId: row.companyId,
      overallScore: row.overallScore,
      pages: safeJsonParse<unknown[]>(row.pages, []),
      recommendations: safeJsonParse<string[]>(row.recommendations, []),
      model: row.model,
      costUsd: row.costUsd,
      createdAt: new Date(row.createdAt).toISOString(),
    }
  }

  getRecommendations = async (runId: string) => {
    const [row] = await this.ctx.sqliteDb.db
      .select()
      .from(recommendations)
      .where(eq(recommendations.runId, runId))
      .orderBy(desc(recommendations.createdAt))
      .limit(1)

    if (!row) return null

    return {
      id: row.id,
      runId: row.runId,
      visibilityGaps: safeJsonParse<unknown[]>(row.visibilityGaps, []),
      sourceOpportunities: safeJsonParse<unknown[]>(row.sourceOpportunities, []),
      competitorInsights: safeJsonParse<unknown[]>(row.competitorInsights, []),
      summary: row.summary,
      model: row.model,
      costUsd: row.costUsd,
      createdAt: new Date(row.createdAt).toISOString(),
    }
  }
}
