import { fetchJson } from './http.js'
import { usageCost } from './common.js'
import type { Provider, ProviderConfig, ProviderResponse } from '../types/index.js'

interface DeepSeekResponse {
  id: string
  model: string
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

export const createDeepSeekProvider = (pricing: {
  costPer1kInputTokens: number
  costPer1kOutputTokens: number
}): Provider => ({
  id: 'deepseek',
  name: 'DeepSeek',
  model: 'deepseek-v4',
  supportsWebSearch: false,
  supportsSourceCitations: false,
  call: async (query: string, config: ProviderConfig): Promise<ProviderResponse> => {
    const started = Date.now()

    const response = await fetchJson<DeepSeekResponse>(
      'https://api.deepseek.com/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: query }],
          temperature: config.temperature ?? 0,
          max_tokens: config.maxTokens ?? 1024,
        }),
      },
      90_000,
    )

    const inputTokens = response.usage?.prompt_tokens ?? 0
    const outputTokens = response.usage?.completion_tokens ?? 0

    return {
      provider: 'deepseek',
      model: config.model,
      query,
      responseText: response.choices?.[0]?.message?.content ?? '',
      sources: null,
      inputTokens,
      outputTokens,
      costUsd: usageCost({ inputTokens, outputTokens, pricing }),
      durationMs: Date.now() - started,
      raw: response,
    }
  },
})
