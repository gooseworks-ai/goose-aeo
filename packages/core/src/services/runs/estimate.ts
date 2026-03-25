import { estimateWithAveragePricing, roundUsd } from '../../utils/cost.js'
import type { PricingConfig, ProviderId, RunEstimate } from '../../types/index.js'

export const estimateRunCost = (args: {
  queriesCount: number
  providers: ProviderId[]
  pricing: PricingConfig
}): RunEstimate => {
  const providerBreakdown = {
    perplexity: 0,
    openai: 0,
    gemini: 0,
    grok: 0,
    claude: 0,
    deepseek: 0,
  } as Record<ProviderId, number>

  for (const provider of args.providers) {
    providerBreakdown[provider] = estimateWithAveragePricing(args.queriesCount, args.pricing.providers[provider])
  }

  const totalApiCalls = args.queriesCount * args.providers.length
  const analysisCostUsd = estimateWithAveragePricing(totalApiCalls, {
    avgInputTokens: args.pricing.analysis.avgInputTokens,
    avgOutputTokens: args.pricing.analysis.avgOutputTokens,
    costPer1kInputTokens: args.pricing.analysis.costPer1kInputTokens,
    costPer1kOutputTokens: args.pricing.analysis.costPer1kOutputTokens,
  })

  const providersCost = args.providers.reduce((sum, provider) => sum + providerBreakdown[provider], 0)

  return {
    queries: args.queriesCount,
    providers: args.providers,
    totalApiCalls,
    providerBreakdown,
    analysisCostUsd,
    totalUsd: roundUsd(providersCost + analysisCostUsd),
  }
}
