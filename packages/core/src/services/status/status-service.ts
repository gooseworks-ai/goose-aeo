import { and, desc, eq, isNull } from 'drizzle-orm'
import { queries, runMetrics, runs } from '../../db/schema.js'
import { fileSizeMb } from '../../utils/fs.js'
import type { AEOContext } from '../../context.js'
import type { RunStatus, StatusResult } from '../../types/index.js'

export class StatusService {
  constructor(private readonly ctx: AEOContext) {}

  get = async (): Promise<StatusResult> => {
    const totalQueriesRows = await this.ctx.sqliteDb.db
      .select({ id: queries.id })
      .from(queries)
      .where(and(eq(queries.companyId, 'company_default'), isNull(queries.deprecatedAt)))

    const allRuns = await this.ctx.sqliteDb.db.select().from(runs).orderBy(desc(runs.startedAt))
    const latest = allRuns[0] ?? null

    let visibilityRate: number | null = null
    if (latest) {
      const metric = await this.ctx.sqliteDb.db
        .select({ value: runMetrics.value })
        .from(runMetrics)
        .where(
          and(
            eq(runMetrics.runId, latest.id),
            eq(runMetrics.metric, 'visibility_rate'),
            isNull(runMetrics.provider),
          ),
        )
        .limit(1)

      visibilityRate = metric[0]?.value ?? null
    }

    return {
      company: this.ctx.config.domain,
      totalQueries: totalQueriesRows.length,
      totalRuns: allRuns.length,
      latestRun: latest
        ? {
            id: latest.id,
            status: latest.status as RunStatus,
            completedAt: latest.completedAt ? new Date(latest.completedAt).toISOString() : null,
            visibilityRate,
            actualCostUsd: latest.actualCost,
          }
        : null,
      dbPath: this.ctx.dbPath,
      dbSizeMb: fileSizeMb(this.ctx.dbPath),
    }
  }
}
