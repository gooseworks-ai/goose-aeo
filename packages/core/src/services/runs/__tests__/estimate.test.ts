import { describe, expect, it } from 'vitest'
import { estimateRunCost } from '../estimate.js'
import type { PricingConfig } from '../../../types/index.js'

const pricing: PricingConfig = {
  providers: {
    perplexity: {
      model: 'sonar-pro',
      costPer1kInputTokens: 0.003,
      costPer1kOutputTokens: 0.015,
      avgInputTokens: 50,
      avgOutputTokens: 400,
    },
    openai: {
      model: 'gpt-5.4',
      costPer1kInputTokens: 0.0025,
      costPer1kOutputTokens: 0.015,
      avgInputTokens: 50,
      avgOutputTokens: 500,
    },
    gemini: {
      model: 'gemini-3.1-pro',
      costPer1kInputTokens: 0.002,
      costPer1kOutputTokens: 0.012,
      avgInputTokens: 50,
      avgOutputTokens: 350,
    },
    grok: {
      model: 'grok-4.20',
      costPer1kInputTokens: 0.003,
      costPer1kOutputTokens: 0.015,
      avgInputTokens: 50,
      avgOutputTokens: 450,
    },
    claude: {
      model: 'claude-sonnet-4-6',
      costPer1kInputTokens: 0.003,
      costPer1kOutputTokens: 0.015,
      avgInputTokens: 80,
      avgOutputTokens: 500,
    },
    deepseek: {
      model: 'deepseek-v4',
      costPer1kInputTokens: 0.0003,
      costPer1kOutputTokens: 0.0005,
      avgInputTokens: 50,
      avgOutputTokens: 400,
    },
  },
  analysis: {
    model: 'gpt-5.4-mini',
    costPer1kInputTokens: 0.00075,
    costPer1kOutputTokens: 0.0045,
    avgInputTokens: 800,
    avgOutputTokens: 350,
  },
}

describe('estimateRunCost', () => {
  it('computes per-provider and analysis estimate', () => {
    const estimate = estimateRunCost({
      queriesCount: 100,
      providers: ['perplexity', 'openai', 'gemini'],
      pricing,
    })

    expect(estimate.totalApiCalls).toBe(300)
    expect(estimate.providerBreakdown.perplexity).toBeGreaterThan(0)
    expect(estimate.providerBreakdown.openai).toBeGreaterThan(0)
    expect(estimate.analysisCostUsd).toBeGreaterThan(0)
    expect(estimate.totalUsd).toBeCloseTo(
      estimate.providerBreakdown.perplexity +
        estimate.providerBreakdown.openai +
        estimate.providerBreakdown.gemini +
        estimate.analysisCostUsd,
      4,
    )
  })
})
