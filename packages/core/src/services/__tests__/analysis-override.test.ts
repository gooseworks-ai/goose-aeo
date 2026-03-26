import { describe, it, expect } from 'vitest'
import type { AnalysisOutput } from '../../analysis/schema.js'
import type { BrandMatchResult } from '../../utils/brand-matching.js'

const applyOverrides = (parsed: AnalysisOutput, brandMatch: BrandMatchResult): AnalysisOutput => {
  let result = { ...parsed }

  if (brandMatch.found && !result.mentioned) {
    result = {
      ...result,
      mentioned: true,
      mention_type: result.mention_type ?? 'direct_name',
      mention_context: result.mention_context === 'not_mentioned' ? 'passing_mention' : result.mention_context,
      total_mentions: Math.max(result.total_mentions, brandMatch.matchCount),
      sentiment: result.sentiment === 'not_mentioned' ? 'neutral' : result.sentiment,
    }
  }

  if (!brandMatch.found && result.mentioned && result.mention_type !== 'indirect') {
    result = { ...result, mention_type: 'indirect' }
  }

  return result
}

const baseParsed: AnalysisOutput = {
  mentioned: false,
  mention_type: null,
  total_mentions: 0,
  first_mention_sentence: null,
  prominence_score: 0,
  mention_context: 'not_mentioned',
  list_position: null,
  recommended_as_best: false,
  domain_cited_as_source: false,
  source_position: null,
  competitors_mentioned: [],
  our_rank_vs_competitors: null,
  ranked_above: [],
  ranked_below: [],
  sentiment: 'not_mentioned',
  sentiment_score: 0,
  sentiment_note: '',
  response_type: 'other',
  relevant_excerpt: '',
}

const foundMatch: BrandMatchResult = {
  found: true,
  matchedTerms: ['n8n'],
  matchCount: 3,
  firstMatchIndex: 10,
}

const noMatch: BrandMatchResult = {
  found: false,
  matchedTerms: [],
  matchCount: 0,
  firstMatchIndex: null,
}

describe('analysis overrides', () => {
  it('overrides false negative: brand found but LLM says not mentioned', () => {
    const result = applyOverrides(baseParsed, foundMatch)
    expect(result.mentioned).toBe(true)
    expect(result.mention_type).toBe('direct_name')
    expect(result.mention_context).toBe('passing_mention')
    expect(result.total_mentions).toBe(3)
    expect(result.sentiment).toBe('neutral')
  })

  it('downgrades false positive: brand not found but LLM says mentioned', () => {
    const llmSaysMentioned: AnalysisOutput = {
      ...baseParsed,
      mentioned: true,
      mention_type: 'direct_name',
      total_mentions: 2,
    }
    const result = applyOverrides(llmSaysMentioned, noMatch)
    expect(result.mentioned).toBe(true) // don't override mentioned
    expect(result.mention_type).toBe('indirect') // downgrade type
  })

  it('does not change when both agree: mentioned', () => {
    const llmSaysMentioned: AnalysisOutput = {
      ...baseParsed,
      mentioned: true,
      mention_type: 'direct_name',
      total_mentions: 2,
      mention_context: 'listed',
      sentiment: 'positive',
    }
    const result = applyOverrides(llmSaysMentioned, foundMatch)
    expect(result.mentioned).toBe(true)
    expect(result.mention_type).toBe('direct_name')
    expect(result.mention_context).toBe('listed')
  })

  it('does not change when both agree: not mentioned', () => {
    const result = applyOverrides(baseParsed, noMatch)
    expect(result.mentioned).toBe(false)
    expect(result.mention_type).toBeNull()
  })

  it('preserves indirect mention_type when LLM already set it', () => {
    const llmSaysIndirect: AnalysisOutput = {
      ...baseParsed,
      mentioned: true,
      mention_type: 'indirect',
      total_mentions: 1,
    }
    const result = applyOverrides(llmSaysIndirect, noMatch)
    expect(result.mention_type).toBe('indirect') // already indirect, no change
  })
})
