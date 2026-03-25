import { desc, eq } from 'drizzle-orm'
import { analysisResults, queries, runMetrics, runs } from '../../db/schema.js'
import type { AEOContext } from '../../context.js'
import type { ReportResult } from '../../types/index.js'

const latestRunId = async (ctx: AEOContext): Promise<string> => {
  const latest = await ctx.sqliteDb.db.select().from(runs).orderBy(desc(runs.startedAt)).limit(1)
  if (!latest[0]) {
    throw new Error('No runs found.')
  }

  return latest[0].id
}

export class ReportService {
  constructor(private readonly ctx: AEOContext) {}

  create = async (args: { runId?: string; compareRunId?: string }): Promise<ReportResult> => {
    const runId = args.runId ?? (await latestRunId(this.ctx))

    const rows = await this.ctx.sqliteDb.db
      .select({ provider: runMetrics.provider, metric: runMetrics.metric, value: runMetrics.value })
      .from(runMetrics)
      .where(eq(runMetrics.runId, runId))

    const overallMetrics = rows
      .filter((row) => row.provider === null)
      .reduce<Record<string, number>>((acc, row) => {
        acc[row.metric] = row.value
        return acc
      }, {})

    const providerMap = new Map<string, Record<string, number>>()
    for (const row of rows.filter((entry) => entry.provider !== null)) {
      const provider = row.provider as string
      const metrics = providerMap.get(provider) ?? {}
      metrics[row.metric] = row.value
      providerMap.set(provider, metrics)
    }

    const providerMetrics = Array.from(providerMap.entries()).map(([provider, metrics]) => ({
      provider: provider as ReportResult['providerMetrics'][number]['provider'],
      metrics,
    }))

    const queryRows = await this.ctx.sqliteDb.db
      .select({
        queryId: analysisResults.queryId,
        mentioned: analysisResults.mentioned,
      })
      .from(analysisResults)
      .where(eq(analysisResults.runId, runId))

    const queryTextRows = await this.ctx.sqliteDb.db
      .select({ id: queries.id, text: queries.text })
      .from(queries)

    const queryTextMap = new Map(queryTextRows.map((row) => [row.id, row.text]))

    const grouped = new Map<string, { total: number; mentioned: number }>()
    for (const row of queryRows) {
      const current = grouped.get(row.queryId) ?? { total: 0, mentioned: 0 }
      current.total += 1
      current.mentioned += row.mentioned === 1 ? 1 : 0
      grouped.set(row.queryId, current)
    }

    const queryScores = Array.from(grouped.entries()).map(([queryId, stats]) => ({
      queryId,
      query: queryTextMap.get(queryId) ?? queryId,
      visibilityRate: stats.total > 0 ? stats.mentioned / stats.total : 0,
    }))

    queryScores.sort((a, b) => b.visibilityRate - a.visibilityRate)

    const compareTo = args.compareRunId
      ? await this.buildCompare(runId, args.compareRunId, overallMetrics)
      : undefined

    return {
      runId,
      company: this.ctx.config.name,
      domain: this.ctx.config.domain,
      generatedAt: new Date().toISOString(),
      metrics: overallMetrics,
      providerMetrics,
      topQueries: queryScores.slice(0, 10),
      bottomQueries: [...queryScores].reverse().slice(0, 10),
      compareTo,
    }
  }

  private buildCompare = async (
    _currentRunId: string,
    compareRunId: string,
    currentMetrics: Record<string, number>,
  ) => {
    const compareRows = await this.ctx.sqliteDb.db
      .select({ metric: runMetrics.metric, value: runMetrics.value })
      .from(runMetrics)
      .where(eq(runMetrics.runId, compareRunId))

    const previous = compareRows
      .filter((row) => row.metric && row.value !== null)
      .reduce<Record<string, number>>((acc, row) => {
        acc[row.metric] = row.value
        return acc
      }, {})

    const deltas = Object.keys(currentMetrics).map((metric) => {
      const current = currentMetrics[metric] ?? 0
      const prior = previous[metric] ?? 0
      return {
        metric,
        current,
        previous: prior,
        delta: current - prior,
      }
    })

    return {
      runId: compareRunId,
      deltas,
    }
  }
}
