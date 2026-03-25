import { fetchJson } from './http.js'
import { usageCost } from './common.js'
import type { Provider, ProviderConfig, ProviderResponse } from '../types/index.js'

interface ClaudeResponse {
  id: string
  model: string
  content?: Array<{
    type?: string
    text?: string
  }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}

const callClaude = async (
  query: string,
  config: ProviderConfig,
  withWebSearch: boolean,
): Promise<ClaudeResponse> => {
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens ?? 1024,
    temperature: config.temperature ?? 0,
    messages: [{ role: 'user', content: query }],
  }

  if (withWebSearch) {
    body.tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
      },
    ]
  }

  return fetchJson<ClaudeResponse>(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    90_000,
  )
}

export const createClaudeProvider = (pricing: {
  costPer1kInputTokens: number
  costPer1kOutputTokens: number
}): Provider => ({
  id: 'claude',
  name: 'Claude',
  model: 'claude-sonnet-4-6',
  supportsWebSearch: true,
  supportsSourceCitations: true,
  call: async (query: string, config: ProviderConfig): Promise<ProviderResponse> => {
    const started = Date.now()
    let response: ClaudeResponse

    try {
      response = await callClaude(query, config, true)
    } catch {
      response = await callClaude(query, config, false)
    }

    const inputTokens = response.usage?.input_tokens ?? 0
    const outputTokens = response.usage?.output_tokens ?? 0

    return {
      provider: 'claude',
      model: config.model,
      query,
      responseText: response.content?.map((part) => part.text ?? '').join('\n') ?? '',
      sources: null,
      inputTokens,
      outputTokens,
      costUsd: usageCost({ inputTokens, outputTokens, pricing }),
      durationMs: Date.now() - started,
      raw: {
        ...response,
        metadata: {
          self_evaluation: true,
        },
      },
    }
  },
})
