import { fetchJson } from './http.js'
import { normalizeSources, usageCost } from './common.js'
import type { Provider, ProviderConfig, ProviderResponse, Source } from '../types/index.js'

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: {
          uri?: string
          title?: string
        }
      }>
    }
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
}

const parseGeminiSources = (response: GeminiResponse): Source[] | null => {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
  const sources = chunks
    .map((chunk) => ({
      url: chunk.web?.uri ?? '',
      title: chunk.web?.title,
    }))
    .filter((item) => Boolean(item.url))

  return sources.length > 0 ? normalizeSources(sources) : null
}

export const createGeminiProvider = (pricing: {
  costPer1kInputTokens: number
  costPer1kOutputTokens: number
}): Provider => ({
  id: 'gemini',
  name: 'Gemini',
  model: 'gemini-3.1-pro',
  supportsWebSearch: true,
  supportsSourceCitations: true,
  call: async (query: string, config: ProviderConfig): Promise<ProviderResponse> => {
    const started = Date.now()
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`

    const response = await fetchJson<GeminiResponse>(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: query }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: config.temperature ?? 0,
            maxOutputTokens: config.maxTokens ?? 1024,
          },
        }),
      },
      90_000,
    )

    const responseText =
      response.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .filter(Boolean)
        .join('\n') ?? ''

    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0

    return {
      provider: 'gemini',
      model: config.model,
      query,
      responseText,
      sources: parseGeminiSources(response),
      inputTokens,
      outputTokens,
      costUsd: usageCost({ inputTokens, outputTokens, pricing }),
      durationMs: Date.now() - started,
      raw: response,
    }
  },
})
