import { describe, expect, it } from 'vitest'
import { buildMetrics, type AnalysisRow } from '../compute-metrics.js'

const rows: AnalysisRow[] = [
  {
    provider: 'openai',
    mentioned: 1,
    prominenceScore: 8,
    mentionContext: 'primary_recommendation',
    domainCitedAsSource: 1,
    competitorsMentioned: JSON.stringify([{ domain: 'comp1.com' }]),
    sentimentScore: 0.6,
    ourRankVsCompetitors: 1,
  },
  {
    provider: 'openai',
    mentioned: 0,
    prominenceScore: 0,
    mentionContext: 'not_mentioned',
    domainCitedAsSource: 0,
    competitorsMentioned: JSON.stringify([{ domain: 'comp2.com' }, { domain: 'comp3.com' }]),
    sentimentScore: 0,
    ourRankVsCompetitors: null,
  },
]

describe('buildMetrics', () => {
  it('computes visibility, share of voice, and sentiment aggregates', () => {
    const metrics = buildMetrics(rows, 1.23)

    expect(metrics.visibility_rate).toBe(0.5)
    expect(metrics.citation_rate).toBe(0.5)
    expect(metrics.top_recommendation_rate).toBe(0.5)
    expect(metrics.avg_prominence_score).toBe(8)
    expect(metrics.share_of_voice).toBeCloseTo(0.25, 4)
    expect(metrics.total_cost_usd).toBe(1.23)
  })
})
