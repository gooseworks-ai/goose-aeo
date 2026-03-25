import { fetchJson } from './http.js'
import { normalizeSources, usageCost } from './common.js'
import type { Provider, ProviderConfig, ProviderResponse, Source } from '../types/index.js'

interface OpenAICompletionResponse {
  id: string
  model: string
  choices?: Array<{
    message?: {
      content?: OpenAIMessageContent
      tool_calls?: unknown[]
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

type OpenAIContentPart = {
  type?: string
  text?: string
  annotations?: Array<{ url?: string; title?: string }>
}

type OpenAIMessageContent = string | OpenAIContentPart[] | undefined

const parseOpenAIText = (content: OpenAIMessageContent): string => {
  if (!content) {
    return ''
  }

  if (typeof content === 'string') {
    return content
  }

  return content
    .map((part: OpenAIContentPart) => part.text ?? '')
    .filter(Boolean)
    .join('\n')
}

const parseOpenAISources = (content: OpenAIMessageContent): Source[] | null => {
  if (!Array.isArray(content)) {
    return null
  }

  const annotations = content.flatMap((part) => part.annotations ?? [])
  const uniqueUrls = new Map<string, { url: string; title?: string }>()

  for (const annotation of annotations) {
    if (!annotation.url) {
      continue
    }

    uniqueUrls.set(annotation.url, {
      url: annotation.url,
      title: annotation.title,
    })
  }

  if (uniqueUrls.size === 0) {
    return null
  }

  return normalizeSources(Array.from(uniqueUrls.values()))
}

const callOpenAI = async (
  query: string,
  config: ProviderConfig,
  withWebSearch: boolean,
): Promise<OpenAICompletionResponse> => {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [{ role: 'user', content: query }],
    temperature: config.temperature ?? 0,
    max_tokens: config.maxTokens ?? 1024,
  }

  if (withWebSearch) {
    body.tools = [{ type: 'web_search_preview' }]
  }

  return fetchJson<OpenAICompletionResponse>(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    90_000,
  )
}

export const createOpenAIProvider = (pricing: {
  costPer1kInputTokens: number
  costPer1kOutputTokens: number
}): Provider => ({
  id: 'openai',
  name: 'OpenAI',
  model: 'gpt-5.4',
  supportsWebSearch: true,
  supportsSourceCitations: true,
  call: async (query: string, config: ProviderConfig): Promise<ProviderResponse> => {
    const started = Date.now()
    let response: OpenAICompletionResponse

    try {
      response = await callOpenAI(query, config, true)
    } catch {
      response = await callOpenAI(query, config, false)
    }

    const message = response.choices?.[0]?.message
    const content = message?.content
    const responseText = parseOpenAIText(content)
    const inputTokens = response.usage?.prompt_tokens ?? 0
    const outputTokens = response.usage?.completion_tokens ?? 0

    return {
      provider: 'openai',
      model: config.model,
      query,
      responseText,
      sources: parseOpenAISources(content),
      inputTokens,
      outputTokens,
      costUsd: usageCost({ inputTokens, outputTokens, pricing }),
      durationMs: Date.now() - started,
      raw: response,
    }
  },
})
