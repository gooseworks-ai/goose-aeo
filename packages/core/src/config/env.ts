import type { ProviderId } from '../types/index.js'

const providerEnvMap: Record<ProviderId, string> = {
  perplexity: 'GOOSE_AEO_PERPLEXITY_API_KEY',
  openai: 'GOOSE_AEO_OPENAI_API_KEY',
  gemini: 'GOOSE_AEO_GEMINI_API_KEY',
  grok: 'GOOSE_AEO_GROK_API_KEY',
  claude: 'GOOSE_AEO_CLAUDE_API_KEY',
  deepseek: 'GOOSE_AEO_DEEPSEEK_API_KEY',
}

export const providerApiKeyEnvVar = (providerId: ProviderId): string => providerEnvMap[providerId]

export const getProviderApiKey = (providerId: ProviderId): string => {
  const key = process.env[providerEnvMap[providerId]]
  if (!key) {
    throw new Error(`Missing API key env var ${providerEnvMap[providerId]} for provider '${providerId}'.`)
  }

  return key
}

export const getFirecrawlApiKey = (): string => {
  const key = process.env.GOOSE_AEO_FIRECRAWL_API_KEY
  if (!key) {
    throw new Error('Missing GOOSE_AEO_FIRECRAWL_API_KEY environment variable.')
  }

  return key
}
