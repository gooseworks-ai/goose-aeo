import type { PricingModelEntry } from '../types/index.js'

export const tokenCostUsd = (
  inputTokens: number,
  outputTokens: number,
  pricing: Pick<PricingModelEntry, 'costPer1kInputTokens' | 'costPer1kOutputTokens'>,
): number => {
  const inputCost = (inputTokens / 1000) * pricing.costPer1kInputTokens
  const outputCost = (outputTokens / 1000) * pricing.costPer1kOutputTokens
  return roundUsd(inputCost + outputCost)
}

export const estimateWithAveragePricing = (
  calls: number,
  pricing: Pick<PricingModelEntry, 'avgInputTokens' | 'avgOutputTokens' | 'costPer1kInputTokens' | 'costPer1kOutputTokens'>,
): number => {
  return tokenCostUsd(calls * pricing.avgInputTokens, calls * pricing.avgOutputTokens, pricing)
}

export const roundUsd = (value: number): number => {
  return Math.round(value * 10000) / 10000
}
