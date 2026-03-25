import { createClaudeProvider } from './claude.js'
import { createDeepSeekProvider } from './deepseek.js'
import { createGeminiProvider } from './gemini.js'
import { createGrokProvider } from './grok.js'
import { createOpenAIProvider } from './openai.js'
import { createPerplexityProvider } from './perplexity.js'
import type { PricingConfig, Provider, ProviderId } from '../types/index.js'

export const buildProviderMap = (pricing: PricingConfig): Record<ProviderId, Provider> => {
  return {
    perplexity: createPerplexityProvider(pricing.providers.perplexity),
    openai: createOpenAIProvider(pricing.providers.openai),
    gemini: createGeminiProvider(pricing.providers.gemini),
    grok: createGrokProvider(pricing.providers.grok),
    claude: createClaudeProvider(pricing.providers.claude),
    deepseek: createDeepSeekProvider(pricing.providers.deepseek),
  }
}
