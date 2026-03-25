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

  if (!existsSync(pricingPath)) {
    throw new Error(`Pricing config not found at ${pricingPath}`)
  }

  const raw = JSON.parse(readFileSync(pricingPath, 'utf8'))
  return mapPricing(pricingSchema.parse(raw))
}
