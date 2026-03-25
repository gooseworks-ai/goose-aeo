import { desc, eq, isNull } from 'drizzle-orm'
import OpenAI from 'openai'
import pLimit from 'p-limit'
import { audits, companies, queries } from '../../db/schema.js'
import { scrapePagesSeparately } from '../queries/scrape.js'
import { idWithPrefix, nowEpochMs } from '../../utils/id.js'
import { safeJsonParse, stripCodeFences } from '../../utils/json.js'
import { tokenCostUsd } from '../../utils/cost.js'
import { truncate } from '../../utils/text.js'
import { pageAuditResponseSchema } from './schema.js'
import type { AEOContext } from '../../context.js'
import type { AuditResult, AuditInput, PageAuditScore } from '../../types/index.js'

export class AuditService {
  constructor(private readonly ctx: AEOContext) {}

  run = async (input?: AuditInput): Promise<AuditResult> => {
    // 1. Get company from DB
    const [company] = await this.ctx.sqliteDb.db
      .select()
      .from(companies)
      .limit(1)

    if (!company) {
      throw new Error('No company found. Run `goose-aeo init` first.')
    }

    // 2. Get active tracked queries
    const activeQueries = await this.ctx.sqliteDb.db
      .select()
      .from(queries)
      .where(isNull(queries.deprecatedAt))
      .orderBy(desc(queries.createdAt))
      .limit(20)

    const queryTexts = activeQueries.map((q) => q.text)

    // 3. Scrape pages separately
    const pages = await scrapePagesSeparately({
      domain: company.domain,
      firecrawlApiKey: process.env.GOOSE_AEO_FIRECRAWL_API_KEY,
      maxPages: input?.maxPages ?? 20,
    })

    if (pages.length === 0) {
      throw new Error(`Could not scrape any pages from ${company.domain}`)
    }

    // 4. Score each page with LLM
    const model = input?.model ?? this.ctx.config.analysis.model
    const apiKey = process.env.GOOSE_AEO_OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('GOOSE_AEO_OPENAI_API_KEY is required for audit scoring')
    }

    const openai = new OpenAI({ apiKey })
    const limit = pLimit(3)
    let totalCost = 0

    const pageScores: PageAuditScore[] = await Promise.all(
      pages.map((page) =>
        limit(async (): Promise<PageAuditScore> => {
          try {
            const prompt = buildScoringPrompt({
              url: page.url,
              content: truncate(page.content, 15_000),
              companyDescription: company.description ?? '',
              trackedQueries: queryTexts,
            })

            const response = await openai.chat.completions.create({
              model,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.2,
              max_completion_tokens: 1000,
            })

            const choice = response.choices[0]
            const raw = choice?.message?.content ?? ''

            // Track cost
            const inputTokens = response.usage?.prompt_tokens ?? 0
            const outputTokens = response.usage?.completion_tokens ?? 0
            const pricing = this.ctx.pricing.analysis
            const cost = tokenCostUsd(inputTokens, outputTokens, pricing)
            totalCost += cost

            // Parse response
            const cleaned = stripCodeFences(raw)
            const parsed = pageAuditResponseSchema.safeParse(JSON.parse(cleaned))

            if (!parsed.success) {
              return zeroScore(page.url, ['Failed to parse LLM response'])
            }

            const scores = parsed.data
            const overallScore =
              (scores.positioningClarity +
                scores.structuredContent +
                scores.queryAlignment +
                scores.technicalSignals +
                scores.contentDepth +
                scores.comparisonContent) /
              6

            return {
              url: page.url,
              positioningClarity: scores.positioningClarity,
              structuredContent: scores.structuredContent,
              queryAlignment: scores.queryAlignment,
              technicalSignals: scores.technicalSignals,
              contentDepth: scores.contentDepth,
              comparisonContent: scores.comparisonContent,
              overallScore: Math.round(overallScore * 10) / 10,
              notes: scores.notes,
            }
          } catch {
            return zeroScore(page.url, ['LLM call failed for this page'])
          }
        }),
      ),
    )

    // 5. Compute overall score
    const validPages = pageScores.filter((p) => p.overallScore > 0)
    const overallScore =
      validPages.length > 0
        ? Math.round(
            (validPages.reduce((sum, p) => sum + p.overallScore, 0) / validPages.length) * 10,
          ) / 10
        : 0

    // 6. Generate recommendations
    const recommendations = generateRecommendations(pageScores)

    // 7. Store in DB
    const id = idWithPrefix('aud')
    const now = nowEpochMs()

    await this.ctx.sqliteDb.db.insert(audits).values({
      id,
      companyId: company.id,
      overallScore,
      pages: JSON.stringify(pageScores),
      recommendations: JSON.stringify(recommendations),
      model,
      costUsd: totalCost,
      createdAt: now,
    })

    return {
      id,
      companyId: company.id,
      overallScore,
      pages: pageScores,
      recommendations,
      model,
      costUsd: totalCost,
      createdAt: new Date(now).toISOString(),
    }
  }
}

function zeroScore(url: string, notes: string[]): PageAuditScore {
  return {
    url,
    positioningClarity: 0,
    structuredContent: 0,
    queryAlignment: 0,
    technicalSignals: 0,
    contentDepth: 0,
    comparisonContent: 0,
    overallScore: 0,
    notes,
  }
}

function buildScoringPrompt(args: {
  url: string
  content: string
  companyDescription: string
  trackedQueries: string[]
}): string {
  const queriesBlock =
    args.trackedQueries.length > 0
      ? `\n\nTracked queries this company cares about:\n${args.trackedQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : ''

  const descBlock = args.companyDescription
    ? `\n\nCompany description: ${args.companyDescription}`
    : ''

  return `You are an AI search readability auditor. Score the following web page on 6 dimensions (0-10 each).
${descBlock}${queriesBlock}

Page URL: ${args.url}

Page content:
${args.content}

Score each dimension:
- positioningClarity (0-10): Does this page clearly state what the product does within the first 2-3 paragraphs?
- structuredContent (0-10): Does this page use clear headings, bullet points, numbered lists, FAQ sections?
- queryAlignment (0-10): Does this page content match the tracked queries? Would an AI engine cite this page when answering these queries?
- technicalSignals (0-10): Does this page have good meta descriptions, schema markup, clean structure?
- contentDepth (0-10): Is there enough substantive, detailed content for an AI to cite?
- comparisonContent (0-10): Does this page compare the product to alternatives, or position it relative to competitors?

Also provide 1-3 brief notes about the most impactful improvements for this page.

Respond ONLY with JSON in this exact format:
{
  "positioningClarity": <number>,
  "structuredContent": <number>,
  "queryAlignment": <number>,
  "technicalSignals": <number>,
  "contentDepth": <number>,
  "comparisonContent": <number>,
  "notes": ["<string>", ...]
}`
}

function generateRecommendations(pages: PageAuditScore[]): string[] {
  const recommendations: string[] = []
  const validPages = pages.filter((p) => p.overallScore > 0)
  if (validPages.length === 0) return ['Unable to generate recommendations — no pages could be scored.']

  // Compute average scores per dimension
  const avg = (key: keyof Omit<PageAuditScore, 'url' | 'overallScore' | 'notes'>) =>
    validPages.reduce((sum, p) => sum + p[key], 0) / validPages.length

  const avgPositioning = avg('positioningClarity')
  const avgStructured = avg('structuredContent')
  const avgQueryAlignment = avg('queryAlignment')
  const avgTechnical = avg('technicalSignals')
  const avgDepth = avg('contentDepth')
  const avgComparison = avg('comparisonContent')

  if (avgPositioning < 6) {
    recommendations.push(
      'Improve positioning clarity: Add a clear value proposition in the first 2-3 paragraphs of key pages. AI engines rely heavily on early page content.',
    )
  }

  if (avgStructured < 6) {
    recommendations.push(
      'Add structured content: Use FAQ sections, bullet points, and clear headings. AI engines strongly prefer well-structured pages for citation.',
    )
  }

  if (avgQueryAlignment < 6) {
    recommendations.push(
      'Improve query alignment: Create content that directly addresses the queries your audience is asking AI engines. Consider dedicated landing pages for top queries.',
    )
  }

  if (avgTechnical < 6) {
    recommendations.push(
      'Strengthen technical signals: Add schema markup (FAQ, Product, Organization), improve meta descriptions, and ensure clean HTML structure.',
    )
  }

  if (avgDepth < 6) {
    recommendations.push(
      'Increase content depth: Add more substantive detail — case studies, technical specs, methodology explanations. AI engines need enough content to form a meaningful citation.',
    )
  }

  if (avgComparison < 6) {
    recommendations.push(
      'Create comparison content: Add pages comparing your product to alternatives. AI engines frequently cite comparison and "vs" pages.',
    )
  }

  // Collect unique notes from pages
  const allNotes = new Set<string>()
  for (const page of validPages) {
    for (const note of page.notes) {
      allNotes.add(note)
    }
  }

  // Add top page-specific notes if we don't have enough recommendations
  if (recommendations.length < 3) {
    for (const note of allNotes) {
      if (recommendations.length >= 5) break
      recommendations.push(note)
    }
  }

  return recommendations.length > 0
    ? recommendations
    : ['Your site scores well overall. Consider expanding content depth and adding comparison pages for further optimization.']
}
