import { z } from 'zod'

export const pageAuditResponseSchema = z.object({
  positioningClarity: z.number().min(0).max(10),
  structuredContent: z.number().min(0).max(10),
  queryAlignment: z.number().min(0).max(10),
  technicalSignals: z.number().min(0).max(10),
  contentDepth: z.number().min(0).max(10),
  comparisonContent: z.number().min(0).max(10),
  notes: z.array(z.string()),
})

export type PageAuditResponse = z.infer<typeof pageAuditResponseSchema>
