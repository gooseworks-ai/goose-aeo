import { tokenCostUsd } from '../utils/cost.js'
import { domainFromUrl } from '../utils/domain.js'
import type { ProviderResponse, Source } from '../types/index.js'

export const normalizeSources = (items: Array<{ url: string; title?: string; snippet?: string }>): Source[] => {
  return items
    .filter((item) => Boolean(item.url))
    .map((item) => ({
      url: item.url,
      domain: domainFromUrl(item.url),
      title: item.title ?? domainFromUrl(item.url),
      snippet: item.snippet,
    }))
}

export const usageCost = (args: {
  inputTokens: number
  outputTokens: number
  pricing: { costPer1kInputTokens: number; costPer1kOutputTokens: number }
}): number => {
  return tokenCostUsd(args.inputTokens, args.outputTokens, args.pricing)
}

export const emptyProviderResponse = (args: {
  provider: ProviderResponse['provider']
  model: string
  query: string
  durationMs: number
  raw: unknown
}): ProviderResponse => {
  return {
    provider: args.provider,
    model: args.model,
    query: args.query,
    responseText: '',
    sources: null,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    durationMs: args.durationMs,
    raw: args.raw,
  }
}
