import pLimit from 'p-limit'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { runs, queries, providerResponses } from '../../db/schema.js'
import { buildProviderMap } from '../../providers/index.js'
import { getProviderApiKey } from '../../config/env.js'
import { idWithPrefix, nowEpochMs } from '../../utils/id.js'
import { estimateRunCost } from './estimate.js'
import type { AEOContext } from '../../context.js'
import type { ProviderId, RunCreateOptions, RunSummary } from '../../types/index.js'

export class RunService {
  constructor(private readonly ctx: AEOContext) {}

  private resolveProviders = (override?: ProviderId[]): ProviderId[] => {
    if (override && override.length > 0) {
      return override
    }

    return this.ctx.config.providers.map((provider) => provider.id)
  }

  private providerModel = (providerId: ProviderId): string => {
    const found = this.ctx.config.providers.find((provider) => provider.id === providerId)
    if (!found) {
      throw new Error(`Provider '${providerId}' not found in config.`)
    }

    return found.model
  }

  private loadQueries = async (args: { queryIds?: string[]; queryLimit?: number }) => {
    const whereBase = and(eq(queries.companyId, 'company_default'), isNull(queries.deprecatedAt))

    const records = args.queryIds && args.queryIds.length > 0
      ? await this.ctx.sqliteDb.db
          .select()
          .from(queries)
          .where(and(whereBase, inArray(queries.id, args.queryIds)))
      : await this.ctx.sqliteDb.db.select().from(queries).where(whereBase)

    if (args.queryLimit && args.queryLimit > 0) {
      return records.slice(0, args.queryLimit)
    }

    return records
  }

  create = async (options: RunCreateOptions = {}): Promise<{ estimate: ReturnType<typeof estimateRunCost>; summary: RunSummary }> => {
    const selectedQueries = await this.loadQueries({
      queryIds: options.queryIds,
      queryLimit: options.queryLimit,
    })

    if (selectedQueries.length === 0) {
      throw new Error('No active queries available. Run `goose-aeo queries generate` first.')
    }

    const selectedProviders = this.resolveProviders(options.providers)
    const estimate = estimateRunCost({
      queriesCount: selectedQueries.length,
      providers: selectedProviders,
      pricing: this.ctx.pricing,
    })

    const budgetCap = options.budgetLimitUsd ?? this.ctx.config.budgetLimitUsd ?? null
    if (budgetCap !== null && estimate.totalUsd > budgetCap) {
      const summary: RunSummary = {
        runId: idWithPrefix('run'),
        status: 'aborted',
        queriesRun: selectedQueries.length,
        providers: selectedProviders,
        totalApiCalls: estimate.totalApiCalls,
        estimatedCostUsd: estimate.totalUsd,
        actualCostUsd: 0,
        durationSeconds: 0,
        errors: [`Budget cap exceeded: estimate $${estimate.totalUsd} > budget $${budgetCap}`],
      }

      return { estimate, summary }
    }

    if (options.dryRun) {
      const summary: RunSummary = {
        runId: idWithPrefix('run'),
        status: 'pending',
        queriesRun: selectedQueries.length,
        providers: selectedProviders,
        totalApiCalls: estimate.totalApiCalls,
        estimatedCostUsd: estimate.totalUsd,
        actualCostUsd: 0,
        durationSeconds: 0,
        errors: [],
      }

      return { estimate, summary }
    }

    const runId = idWithPrefix('run')
    const startedAt = nowEpochMs()
    const providerMap = buildProviderMap(this.ctx.pricing)
    const providerErrors: string[] = []
    const limiter = pLimit(Math.max(1, options.concurrency ?? 5))

    const queryVersion = Math.max(...selectedQueries.map((query) => query.version))

    await this.ctx.sqliteDb.db.insert(runs).values({
      id: runId,
      companyId: 'company_default',
      status: 'running',
      configSnapshot: JSON.stringify(this.ctx.config),
      queryVersion,
      estimatedCost: estimate.totalUsd,
      actualCost: 0,
      startedAt,
      completedAt: null,
      error: null,
    })

    const tasks = selectedQueries.flatMap((query) => {
      return selectedProviders.map((providerId) => {
        return limiter(async () => {
          const provider = providerMap[providerId]
          const model = this.providerModel(providerId)

          try {
            const apiKey = getProviderApiKey(providerId)
            const response = await provider.call(query.text, {
              model,
              apiKey,
              temperature: 0,
              maxTokens: 1024,
            })

            await this.ctx.sqliteDb.db.insert(providerResponses).values({
              id: idWithPrefix('resp'),
              runId,
              queryId: query.id,
              provider: providerId,
              model: response.model,
              rawResponse: response.responseText,
              sources: response.sources ? JSON.stringify(response.sources) : null,
              inputTokens: response.inputTokens,
              outputTokens: response.outputTokens,
              costUsd: response.costUsd,
              durationMs: response.durationMs,
              createdAt: nowEpochMs(),
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            providerErrors.push(`${providerId}/${query.id}: ${message}`)
          }
        })
      })
    })

    await Promise.all(tasks)

    const responseRows = await this.ctx.sqliteDb.db
      .select({ costUsd: providerResponses.costUsd })
      .from(providerResponses)
      .where(eq(providerResponses.runId, runId))

    const actualCostUsd = responseRows.reduce((sum, row) => sum + (row.costUsd ?? 0), 0)
    const completedAt = nowEpochMs()
    const durationSeconds = Math.round((completedAt - startedAt) / 1000)

    const status = providerErrors.length > 0 && responseRows.length === 0 ? 'failed' : 'complete'

    await this.ctx.sqliteDb.db
      .update(runs)
      .set({
        status,
        actualCost: actualCostUsd,
        completedAt,
        error: providerErrors.length > 0 ? JSON.stringify(providerErrors.slice(0, 25)) : null,
      })
      .where(eq(runs.id, runId))

    const summary: RunSummary = {
      runId,
      status,
      queriesRun: selectedQueries.length,
      providers: selectedProviders,
      totalApiCalls: estimate.totalApiCalls,
      estimatedCostUsd: estimate.totalUsd,
      actualCostUsd,
      durationSeconds,
      errors: providerErrors,
    }

    return { estimate, summary }
  }
}
