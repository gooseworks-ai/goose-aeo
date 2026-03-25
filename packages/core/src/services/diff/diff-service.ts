import { and, eq } from 'drizzle-orm'
import { runMetrics } from '../../db/schema.js'
import type { AEOContext } from '../../context.js'
import type { DiffResult } from '../../types/index.js'

const keyFor = (metric: string, provider: string | null) => `${provider ?? 'all'}::${metric}`

export class DiffService {
  constructor(private readonly ctx: AEOContext) {}

  compare = async (run1: string, run2: string): Promise<DiffResult> => {
    const rows1 = await this.ctx.sqliteDb.db
      .select({ metric: runMetrics.metric, provider: runMetrics.provider, value: runMetrics.value })
      .from(runMetrics)
      .where(eq(runMetrics.runId, run1))

    const rows2 = await this.ctx.sqliteDb.db
      .select({ metric: runMetrics.metric, provider: runMetrics.provider, value: runMetrics.value })
      .from(runMetrics)
      .where(eq(runMetrics.runId, run2))

    const map1 = new Map(rows1.map((row) => [keyFor(row.metric, row.provider), row]))
    const map2 = new Map(rows2.map((row) => [keyFor(row.metric, row.provider), row]))

    const keys = new Set<string>([...map1.keys(), ...map2.keys()])
    const deltas = Array.from(keys)
      .map((key) => {
        const a = map1.get(key)
        const b = map2.get(key)
        const run1Value = a?.value ?? null
        const run2Value = b?.value ?? null

        return {
          metric: b?.metric ?? a?.metric ?? key,
          provider: (b?.provider ?? a?.provider ?? null) as DiffResult['deltas'][number]['provider'],
          run1: run1Value,
          run2: run2Value,
          delta:
            run1Value !== null && run2Value !== null
              ? run2Value - run1Value
              : null,
        }
      })
      .sort((left, right) => `${left.provider ?? 'all'}:${left.metric}`.localeCompare(`${right.provider ?? 'all'}:${right.metric}`))

    return {
      run1,
      run2,
      deltas,
    }
  }
}
