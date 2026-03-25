import { desc, eq } from 'drizzle-orm'
import { providerResponses, runs } from '../../db/schema.js'
import type { AEOContext } from '../../context.js'
import type { CostsResult } from '../../types/index.js'

export class CostsService {
  constructor(private readonly ctx: AEOContext) {}

  list = async (last = 10): Promise<CostsResult> => {
    const runRows = await this.ctx.sqliteDb.db
      .select()
      .from(runs)
      .orderBy(desc(runs.startedAt))
      .limit(Math.max(1, last))

    const runsWithCosts = await Promise.all(
      runRows.map(async (runRow) => {
        const responses = await this.ctx.sqliteDb.db
          .select({ provider: providerResponses.provider, queryId: providerResponses.queryId })
          .from(providerResponses)
          .where(eq(providerResponses.runId, runRow.id))

        return {
          runId: runRow.id,
          date: new Date(runRow.startedAt).toISOString(),
          estimated: runRow.estimatedCost ?? 0,
          actual: runRow.actualCost ?? 0,
          queries: new Set(responses.map((response) => response.queryId)).size,
          providers: new Set(responses.map((response) => response.provider)).size,
        }
      }),
    )

    const allRuns = await this.ctx.sqliteDb.db.select({ actualCost: runs.actualCost }).from(runs)
    const allTimeActual = allRuns.reduce((sum, row) => sum + (row.actualCost ?? 0), 0)

    return {
      runs: runsWithCosts,
      allTimeActual,
      totalRuns: allRuns.length,
    }
  }
}
