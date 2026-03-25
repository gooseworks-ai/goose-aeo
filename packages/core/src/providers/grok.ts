import { fetchJson } from './http.js'
import { usageCost, normalizeSources } from './common.js'
import type { Provider, ProviderConfig, ProviderResponse } from '../types/index.js'

interface GrokAnnotation {
  type: string
  url?: string
  title?: string
}

interface GrokOutputTextContent {
  type: 'output_text'
  text?: string
  annotations?: GrokAnnotation[]
}

interface GrokMessageBlock {
  type: 'message'
  content?: GrokOutputTextContent[]
}

interface GrokOutputBlock {
  type: string
  content?: GrokOutputTextContent[]
}

interface GrokResponse {
  id: string
  model: string
  output?: GrokOutputBlock[]
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}

export const createGrokProvider = (pricing: {
  costPer1kInputTokens: number
  costPer1kOutputTokens: number
}): Provider => ({
  id: 'grok',
  name: 'Grok',
  model: 'grok-4.20',
  supportsWebSearch: true,
  supportsSourceCitations: true,
  call: async (query: string, config: ProviderConfig): Promise<ProviderResponse> => {
    const started = Date.now()

    const response = await fetchJson<GrokResponse>(
      'https://api.x.ai/v1/responses',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          input: query,
          tools: [{ type: 'web_search' }],
          max_output_tokens: config.maxTokens ?? 1024,
          temperature: config.temperature ?? 0,
        }),
      },
      90_000,
    )

    const outputBlocks = response.output ?? []
    const textParts: string[] = []
    const rawAnnotations: GrokAnnotation[] = []

    for (const block of outputBlocks) {
      if (block.type === 'message') {
        for (const item of (block.content ?? [])) {
          if (item.type === 'output_text') {
            textParts.push(item.text ?? '')
            if (Array.isArray(item.annotations)) {
              rawAnnotations.push(...item.annotations)
            }
          }
        }
      }
    }

    const responseText = textParts.join('')
    const citations = rawAnnotations
      .filter((a) => a.type === 'url_citation')
      .map((a) => ({ url: a.url!, title: a.title }))
    const sources = citations.length > 0 ? normalizeSources(citations) : null

    const inputTokens = response.usage?.input_tokens ?? 0
    const outputTokens = response.usage?.output_tokens ?? 0

    return {
      provider: 'grok',
      model: config.model,
      query,
      responseText,
      sources,
      inputTokens,
      outputTokens,
      costUsd: usageCost({ inputTokens, outputTokens, pricing }),
      durationMs: Date.now() - started,
      raw: response,
    }
  },
})
