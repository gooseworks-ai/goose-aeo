import { describe, expect, it } from 'vitest'
import { buildMetrics, type AnalysisRow } from '../compute-metrics.js'

/**
 * Tests that metric values are on the expected scales.
 *
 * Prominence scores are 0-10 in the database (from LLM analysis).
 * The UI converts to percentage by multiplying by 10 (not 100).
 * This test ensures the raw metric values stay in the expected range.
 */

describe('metric value ranges', () => {
  const mentionedRow: AnalysisRow = {
    provider: 'openai',
    mentioned: 1,
    prominenceScore: 7.5,
    mentionContext: 'listed',
    domainCitedAsSource: 1,
    competitorsMentioned: '[]',
    sentimentScore: 0.6,
    ourRankVsCompetitors: 2,
  }

  const notMentionedRow: AnalysisRow = {
    provider: 'openai',
    mentioned: 0,
    prominenceScore: 0,
    mentionContext: 'not_mentioned',
    domainCitedAsSource: 0,
    competitorsMentioned: '[]',
    sentimentScore: 0,
    ourRankVsCompetitors: null,
  }

  it('avg_prominence_score is on 0-10 scale (NOT 0-1)', () => {
    const metrics = buildMetrics([mentionedRow], 0)
    // prominenceScore input is 7.5, so avg should be 7.5
    expect(metrics.avg_prominence_score).toBe(7.5)
    // Verify it's NOT normalized to 0-1
    expect(metrics.avg_prominence_score).toBeGreaterThan(1)
  })

  it('visibility_rate is on 0-1 scale', () => {
    const metrics = buildMetrics([mentionedRow, notMentionedRow], 0)
    expect(metrics.visibility_rate).toBe(0.5)
    expect(metrics.visibility_rate).toBeLessThanOrEqual(1)
    expect(metrics.visibility_rate).toBeGreaterThanOrEqual(0)
  })

  it('avg_sentiment_score is on -1 to 1 scale', () => {
    const metrics = buildMetrics([mentionedRow], 0)
    expect(metrics.avg_sentiment_score).toBe(0.6)
    expect(metrics.avg_sentiment_score).toBeGreaterThanOrEqual(-1)
    expect(metrics.avg_sentiment_score).toBeLessThanOrEqual(1)
  })

  it('prominence percentage conversion: multiply by 10 gives 0-100', () => {
    const metrics = buildMetrics([mentionedRow], 0)
    // This is the formula the UI should use: avgProminence * 10
    const displayPercentage = metrics.avg_prominence_score! * 10
    expect(displayPercentage).toBe(75)
    expect(displayPercentage).toBeLessThanOrEqual(100)
    expect(displayPercentage).toBeGreaterThanOrEqual(0)
  })

  it('prominence * 100 would give wrong values over 100%', () => {
    const metrics = buildMetrics([mentionedRow], 0)
    // This is the WRONG formula: avgProminence * 100
    const wrongPercentage = metrics.avg_prominence_score! * 100
    expect(wrongPercentage).toBe(750) // clearly wrong — 750%
    expect(wrongPercentage).toBeGreaterThan(100)
  })
})
