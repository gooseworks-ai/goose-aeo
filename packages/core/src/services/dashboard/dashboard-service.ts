import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { analysisResults, providerResponses, queries, runMetrics, runs } from '../../db/schema.js'
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
}
