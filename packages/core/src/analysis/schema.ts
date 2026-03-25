import { z } from 'zod'

export const analysisOutputSchema = z.object({
  mentioned: z.boolean(),
  mention_type: z.enum(['direct_name', 'domain_cited', 'product_named', 'indirect']).nullable(),
  total_mentions: z.number().int().nonnegative(),
  first_mention_sentence: z.number().int().nonnegative().nullable(),
  prominence_score: z.number().min(0).max(10),
  mention_context: z.enum([
    'primary_recommendation',
    'top_of_list',
    'listed',
    'passing_mention',
    'not_mentioned',
  ]),
  list_position: z.number().int().positive().nullable(),
  recommended_as_best: z.boolean(),
  domain_cited_as_source: z.boolean(),
  source_position: z.number().int().positive().nullable(),
  competitors_mentioned: z.array(
    z.object({
      domain: z.string(),
      name: z.string(),
    }),
  ),
  our_rank_vs_competitors: z.number().int().positive().nullable(),
  ranked_above: z.array(z.string()),
  ranked_below: z.array(z.string()),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'not_mentioned']),
  sentiment_score: z.number().min(-1).max(1),
  sentiment_note: z.string().max(300),
  response_type: z.enum(['direct_answer', 'ranked_list', 'comparison', 'tutorial', 'other']),
  relevant_excerpt: z.string(),
})

export type AnalysisOutput = z.infer<typeof analysisOutputSchema>
