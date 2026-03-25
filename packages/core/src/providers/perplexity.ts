import { fetchJson } from './http.js'
import { normalizeSources, usageCost } from './common.js'
import type { Provider, ProviderConfig, ProviderResponse, Source } from '../types/index.js'

interface PerplexityResponse {
  id: string
  model: string
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  citations?: Array<string | { url?: string; title?: string; snippet?: string }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

const parseCitations = (citations: PerplexityResponse['citations']): Source[] | null => {
  if (!citations || citations.length === 0) {
    return null
  }

  const normalized = citations
    .map((item) => {
      if (typeof item === 'string') {
        return { url: item }
      }

      return {
        url: item.url ?? '',
        title: item.title,
        snippet: item.snippet,
      }
    })
    .filter((item) => Boolean(item.url))

  return normalized.length > 0 ? normalizeSources(normalized) : null
}

export const createPerplexityProvider = (pricing: {
  costPer1kInputTokens: number
  costPer1kOutputTokens: number
}): Provider => ({
  id: 'perplexity',
  name: 'Perplexity',
  model: 'sonar-pro',
  supportsWebSearch: true,
  supportsSourceCitations: true,
  call: async (query: string, config: ProviderConfig): Promise<ProviderResponse> => {
    const started = Date.now()

    const response = await fetchJson<PerplexityResponse>(
      'https://api.perplexity.ai/chat/completions',
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

    const responseText = response.choices?.[0]?.message?.content ?? ''
    const inputTokens = response.usage?.prompt_tokens ?? 0
    const outputTokens = response.usage?.completion_tokens ?? 0

    return {
      provider: 'perplexity',
      model: config.model,
      query,
      responseText,
      sources: parseCitations(response.citations),
      inputTokens,
      outputTokens,
      costUsd: usageCost({
        inputTokens,
        outputTokens,
        pricing,
      }),
      durationMs: Date.now() - started,
      raw: response,
    }
  },
})
