import { z } from 'zod'
import type { GooseAEOConfig, ProviderId } from '../types/index.js'

const providerIds = ['perplexity', 'openai', 'gemini', 'grok', 'claude', 'deepseek'] as const

export const providerIdSchema = z.enum(providerIds)

export const rawConfigSchema = z.object({
  domain: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  competitors: z
    .array(
      z.object({
        domain: z.string().min(1),
        name: z.string().optional(),
      }),
    )
    .default([]),
  providers: z
    .array(
      z.object({
        id: providerIdSchema,
        model: z.string().min(1),
      }),
    )
    .min(1),
  analysis: z.object({
    provider: providerIdSchema.default('openai'),
    model: z.string().min(1).default('gpt-5.4-mini'),
  }),
  query_limit: z.number().int().min(1).max(500).default(100),
  db_path: z.string().min(1).default('./goose-aeo.db'),
  queries_backup: z.string().optional(),
  budget_limit_usd: z.number().nullable().optional(),
  schedule: z.string().nullable().optional(),
  alerts: z
    .object({
      visibility_rate_drop: z.number().positive().optional(),
      prominence_score_drop: z.number().positive().optional(),
      share_of_voice_drop: z.number().positive().optional(),
    })
    .optional(),
})

export type RawConfig = z.infer<typeof rawConfigSchema>

export const defaultProviderModels: Record<ProviderId, string> = {
  perplexity: 'sonar-pro',
  openai: 'gpt-5.4',
  gemini: 'gemini-3.1-pro',
  grok: 'grok-4.20',
  claude: 'claude-sonnet-4-6',
  deepseek: 'deepseek-v4',
}

export const buildDefaultConfig = (domain: string, name: string): GooseAEOConfig => ({
  domain,
  name,
  description: undefined,
  competitors: [],
  providers: [
    { id: 'perplexity', model: defaultProviderModels.perplexity },
    { id: 'openai', model: defaultProviderModels.openai },
    { id: 'gemini', model: defaultProviderModels.gemini },
  ],
  analysis: {
    provider: 'openai',
    model: 'gpt-5.4-mini',
  },
  queryLimit: 100,
  dbPath: './goose-aeo.db',
  queriesBackup: './queries.json',
  budgetLimitUsd: null,
  schedule: null,
})
