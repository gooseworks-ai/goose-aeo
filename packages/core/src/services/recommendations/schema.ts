import { z } from 'zod'

export const visibilityGapSchema = z.object({
  topic: z.string(),
  queries: z.array(z.string()),
  citedSources: z.array(z.string()),
  mentionedCompetitors: z.array(z.string()),
  recommendation: z.string(),
})

export const sourceOpportunitySchema = z.object({
  domain: z.string(),
  citationCount: z.number(),
  queryContexts: z.array(z.string()),
  recommendation: z.string(),
})

export const competitorInsightSchema = z.object({
  competitor: z.string(),
  domain: z.string(),
  queriesWhereTheyAppear: z.array(z.string()),
  excerpts: z.array(z.string()),
  recommendation: z.string(),
})

export const recommendationResponseSchema = z.object({
  visibilityGaps: z.array(visibilityGapSchema),
  sourceOpportunities: z.array(sourceOpportunitySchema),
  competitorInsights: z.array(competitorInsightSchema),
  summary: z.string(),
})

export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>
