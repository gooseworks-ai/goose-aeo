import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { PricingConfig } from '../types/index.js'

const providerPricingSchema = z.object({
  model: z.string(),
  cost_per_1k_input_tokens: z.number().nonnegative(),
  cost_per_1k_output_tokens: z.number().nonnegative(),
  avg_input_tokens: z.number().nonnegative(),
  avg_output_tokens: z.number().nonnegative(),
})

const pricingSchema = z.object({
  providers: z.object({
    perplexity: providerPricingSchema,
    openai: providerPricingSchema,
    gemini: providerPricingSchema,
    grok: providerPricingSchema,
    claude: providerPricingSchema,
    deepseek: providerPricingSchema,
  }),
  analysis: providerPricingSchema,
})

const DEFAULT_PRICING = {
  providers: {
    perplexity: {
      model: 'sonar-pro',
      cost_per_1k_input_tokens: 0.003,
      cost_per_1k_output_tokens: 0.015,
      avg_input_tokens: 50,
      avg_output_tokens: 400,
    },
    openai: {
      model: 'gpt-5.4',
      cost_per_1k_input_tokens: 0.0025,
      cost_per_1k_output_tokens: 0.015,
      avg_input_tokens: 50,
      avg_output_tokens: 500,
    },
    gemini: {
      model: 'gemini-3-flash-preview',
      cost_per_1k_input_tokens: 0.002,
      cost_per_1k_output_tokens: 0.012,
      avg_input_tokens: 50,
      avg_output_tokens: 350,
    },
    grok: {
      model: 'grok-4.20',
      cost_per_1k_input_tokens: 0.003,
      cost_per_1k_output_tokens: 0.015,
      avg_input_tokens: 50,
      avg_output_tokens: 450,
    },
    claude: {
      model: 'claude-sonnet-4-6',
      cost_per_1k_input_tokens: 0.003,
      cost_per_1k_output_tokens: 0.015,
      avg_input_tokens: 80,
      avg_output_tokens: 500,
    },
    deepseek: {
      model: 'deepseek-v4',
      cost_per_1k_input_tokens: 0.0003,
      cost_per_1k_output_tokens: 0.0005,
      avg_input_tokens: 50,
      avg_output_tokens: 400,
    },
  },
  analysis: {
    model: 'gpt-5.4-mini',
    cost_per_1k_input_tokens: 0.00075,
    cost_per_1k_output_tokens: 0.0045,
    avg_input_tokens: 800,
    avg_output_tokens: 350,
  },
} as const

type RawPricing = z.infer<typeof pricingSchema>

const mapPricing = (raw: RawPricing): PricingConfig => {
  return {
    providers: {
      perplexity: {
        model: raw.providers.perplexity.model,
        costPer1kInputTokens: raw.providers.perplexity.cost_per_1k_input_tokens,
        costPer1kOutputTokens: raw.providers.perplexity.cost_per_1k_output_tokens,
        avgInputTokens: raw.providers.perplexity.avg_input_tokens,
        avgOutputTokens: raw.providers.perplexity.avg_output_tokens,
      },
      openai: {
        model: raw.providers.openai.model,
        costPer1kInputTokens: raw.providers.openai.cost_per_1k_input_tokens,
        costPer1kOutputTokens: raw.providers.openai.cost_per_1k_output_tokens,
        avgInputTokens: raw.providers.openai.avg_input_tokens,
        avgOutputTokens: raw.providers.openai.avg_output_tokens,
      },
      gemini: {
        model: raw.providers.gemini.model,
        costPer1kInputTokens: raw.providers.gemini.cost_per_1k_input_tokens,
        costPer1kOutputTokens: raw.providers.gemini.cost_per_1k_output_tokens,
        avgInputTokens: raw.providers.gemini.avg_input_tokens,
        avgOutputTokens: raw.providers.gemini.avg_output_tokens,
      },
      grok: {
        model: raw.providers.grok.model,
        costPer1kInputTokens: raw.providers.grok.cost_per_1k_input_tokens,
        costPer1kOutputTokens: raw.providers.grok.cost_per_1k_output_tokens,
        avgInputTokens: raw.providers.grok.avg_input_tokens,
        avgOutputTokens: raw.providers.grok.avg_output_tokens,
      },
      claude: {
        model: raw.providers.claude.model,
        costPer1kInputTokens: raw.providers.claude.cost_per_1k_input_tokens,
        costPer1kOutputTokens: raw.providers.claude.cost_per_1k_output_tokens,
        avgInputTokens: raw.providers.claude.avg_input_tokens,
        avgOutputTokens: raw.providers.claude.avg_output_tokens,
      },
      deepseek: {
        model: raw.providers.deepseek.model,
        costPer1kInputTokens: raw.providers.deepseek.cost_per_1k_input_tokens,
        costPer1kOutputTokens: raw.providers.deepseek.cost_per_1k_output_tokens,
        avgInputTokens: raw.providers.deepseek.avg_input_tokens,
        avgOutputTokens: raw.providers.deepseek.avg_output_tokens,
      },
    },
    analysis: {
      model: raw.analysis.model,
      costPer1kInputTokens: raw.analysis.cost_per_1k_input_tokens,
      costPer1kOutputTokens: raw.analysis.cost_per_1k_output_tokens,
      avgInputTokens: raw.analysis.avg_input_tokens,
      avgOutputTokens: raw.analysis.avg_output_tokens,
    },
  }
}

export const loadPricingConfig = (cwd: string, overridePath?: string): PricingConfig => {
  const pricingPath = overridePath
    ? path.resolve(cwd, overridePath)
    : path.resolve(cwd, 'pricing.json')

  if (existsSync(pricingPath)) {
    const raw = JSON.parse(readFileSync(pricingPath, 'utf8'))
    return mapPricing(pricingSchema.parse(raw))
  }

  // Fall back to bundled default pricing when no local file exists
  return mapPricing(pricingSchema.parse(DEFAULT_PRICING))
}
