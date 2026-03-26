import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unlinkSync, existsSync } from 'node:fs'
import { createSqliteDb, type SqliteDb } from '../../../db/client.js'
import { DashboardService } from '../dashboard-service.js'
import type { AEOContext } from '../../../context.js'

let sqliteDb: SqliteDb
let service: DashboardService
let dbPath: string

const fakeContext = (): AEOContext =>
  ({
    sqliteDb,
    config: { domain: 'example.com', name: 'Example' },
  }) as unknown as AEOContext

beforeEach(async () => {
  dbPath = join(tmpdir(), `goose-aeo-dash-test-${Date.now()}.db`)
  sqliteDb = await createSqliteDb(dbPath)
  service = new DashboardService(fakeContext())
  runSeq = 0
})

afterEach(() => {
  sqliteDb.close()
  if (existsSync(dbPath)) unlinkSync(dbPath)
})

const now = Date.now()

const seedCompany = () => {
  sqliteDb.sqliteRaw.run(
    "INSERT INTO companies (id, domain, name, description, config, created_at) VALUES ('co_1', 'example.com', 'Example', 'A test company', '{}', ?)",
    [now],
  )
}

const seedCompetitor = (domain: string, name: string) => {
  sqliteDb.sqliteRaw.run(
    "INSERT INTO competitors (id, company_id, domain, name, created_at) VALUES (?, 'co_1', ?, ?, ?)",
    [`comp_${domain}`, domain, name, now],
  )
}

let runSeq = 0
const seedRun = (id: string, status = 'completed') => {
  runSeq++
  const startedAt = now - 100000 + runSeq * 1000
  sqliteDb.sqliteRaw.run(
    "INSERT INTO runs (id, company_id, status, config_snapshot, query_version, estimated_cost, actual_cost, started_at, completed_at) VALUES (?, 'co_1', ?, '{}', 1, 0.5, 0.4, ?, ?)",
    [id, status, startedAt, status === 'completed' ? startedAt + 500 : null],
  )
}

const seedQuery = (id: string, text: string) => {
  sqliteDb.sqliteRaw.run(
    "INSERT INTO queries (id, company_id, text, version, created_at) VALUES (?, 'co_1', ?, 1, ?)",
    [id, text, now],
  )
}

const seedAnalysisResult = (opts: {
  id: string
  runId: string
  queryId: string
  provider: string
  mentioned: number
  prominenceScore?: number
  sentimentScore?: number
  competitorsMentioned?: string
}) => {
  sqliteDb.sqliteRaw.run(
    `INSERT INTO analysis_results (id, response_id, run_id, query_id, provider, mentioned, prominence_score, sentiment_score, competitors_mentioned, analysis_model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'gpt-5.4-mini', ?)`,
    [
      opts.id,
      `resp_${opts.id}`,
      opts.runId,
      opts.queryId,
      opts.provider,
      opts.mentioned,
      opts.prominenceScore ?? null,
      opts.sentimentScore ?? null,
      opts.competitorsMentioned ?? '[]',
      now,
    ],
  )
  // Also seed the provider_response row (required by foreign key)
  sqliteDb.sqliteRaw.run(
    `INSERT OR IGNORE INTO provider_responses (id, run_id, query_id, provider, model, raw_response, sources, cost_usd, created_at)
     VALUES (?, ?, ?, ?, 'test-model', 'test response', '[]', 0.01, ?)`,
    [`resp_${opts.id}`, opts.runId, opts.queryId, opts.provider, now],
  )
}

const seedRunMetric = (runId: string, metric: string, value: number, provider: string | null = null) => {
  sqliteDb.sqliteRaw.run(
    'INSERT INTO run_metrics (id, run_id, provider, metric, value, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [`m_${runId}_${metric}_${provider ?? 'all'}`, runId, provider, metric, value, now],
  )
}

describe('DashboardService', () => {
  describe('getRuns', () => {
    it('returns runs ordered by startedAt desc', async () => {
      seedCompany()
      seedRun('run_1')
      seedRun('run_2')

      const runs = await service.getRuns()
      expect(runs).toHaveLength(2)
      expect(runs[0]!.id).toBe('run_2')
    })

    it('respects limit and offset', async () => {
      seedCompany()
      seedRun('run_1')
      seedRun('run_2')
      seedRun('run_3')

      const runs = await service.getRuns({ limit: 1, offset: 1 })
      expect(runs).toHaveLength(1)
    })
  })

  describe('getQueryVisibility', () => {
    it('computes visibility rate per query', async () => {
      seedCompany()
      seedRun('run_1')
      seedQuery('q_1', 'best crm software')

      seedAnalysisResult({ id: 'a1', runId: 'run_1', queryId: 'q_1', provider: 'openai', mentioned: 1 })
      seedAnalysisResult({ id: 'a2', runId: 'run_1', queryId: 'q_1', provider: 'gemini', mentioned: 0 })

      const result = await service.getQueryVisibility()
      expect(result).toHaveLength(1)
      expect(result[0]!.visibilityRate).toBe(0.5)
      expect(result[0]!.query).toBe('best crm software')
    })
  })

  describe('getCompetitors', () => {
    it('returns competitor mention counts and totalResponses', async () => {
      seedCompany()
      seedRun('run_1')
      seedQuery('q_1', 'test query')
      seedCompetitor('rival.com', 'Rival')

      seedAnalysisResult({
        id: 'a1',
        runId: 'run_1',
        queryId: 'q_1',
        provider: 'openai',
        mentioned: 1,
        competitorsMentioned: JSON.stringify([{ domain: 'rival.com', name: 'Rival' }]),
      })
      seedAnalysisResult({
        id: 'a2',
        runId: 'run_1',
        queryId: 'q_1',
        provider: 'gemini',
        mentioned: 0,
        competitorsMentioned: JSON.stringify([]),
      })

      const result = await service.getCompetitors('run_1')
      expect(result.totalResponses).toBe(2)
      expect(result.competitors).toHaveLength(1)
      expect(result.competitors[0]!.domain).toBe('rival.com')
      expect(result.competitors[0]!.mentionCount).toBe(1)
      expect(result.competitors[0]!.visibilityRate).toBe(0.5)
      expect(result.ourRank).toBeGreaterThan(0)
    })

    it('returns empty competitors when none configured or mentioned', async () => {
      seedCompany()
      seedRun('run_1')
      seedQuery('q_1', 'test query')

      seedAnalysisResult({ id: 'a1', runId: 'run_1', queryId: 'q_1', provider: 'openai', mentioned: 1 })

      const result = await service.getCompetitors('run_1')
      expect(result.totalResponses).toBe(1)
      expect(result.competitors).toHaveLength(0)
    })
  })

  describe('getCitations', () => {
    it('counts source domain citations', async () => {
      seedCompany()
      seedRun('run_1')
      seedQuery('q_1', 'test query')

      // Seed a provider response with sources
      sqliteDb.sqliteRaw.run(
        `INSERT INTO provider_responses (id, run_id, query_id, provider, model, raw_response, sources, cost_usd, created_at)
         VALUES ('resp_cit', 'run_1', 'q_1', 'openai', 'gpt-5.4', 'response text', ?, 0.01, ?)`,
        [
          JSON.stringify([
            { url: 'https://example.com/page1' },
            { url: 'https://rival.com/docs' },
            { url: 'https://example.com/page2' },
          ]),
          now,
        ],
      )

      const result = await service.getCitations('run_1')
      expect(result.totalCitations).toBe(3)
      expect(result.ownDomainCitations).toBe(2)
      expect(result.domains.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('getTrends', () => {
    it('returns metric values across completed runs in chronological order', async () => {
      seedCompany()
      seedRun('run_1')
      seedRun('run_2')

      seedRunMetric('run_1', 'visibility_rate', 0.3)
      seedRunMetric('run_2', 'visibility_rate', 0.5)

      const result = await service.getTrends('visibility_rate', 10)
      expect(result.metric).toBe('visibility_rate')
      expect(result.points).toHaveLength(2)
      // Should be chronological (run_1 before run_2)
      expect(result.points[0]!.value).toBe(0.3)
      expect(result.points[1]!.value).toBe(0.5)
    })
  })

  describe('getAudits', () => {
    it('returns audits with parsed JSON fields', async () => {
      seedCompany()
      sqliteDb.sqliteRaw.run(
        `INSERT INTO audits (id, company_id, overall_score, pages, recommendations, model, cost_usd, created_at)
         VALUES ('aud_1', 'co_1', 7.5, ?, ?, 'gpt-5.4', 0.05, ?)`,
        [
          JSON.stringify([{ url: 'https://example.com', overallScore: 7.5 }]),
          JSON.stringify(['Improve FAQ section']),
          now,
        ],
      )

      const audits = await service.getAudits()
      expect(audits).toHaveLength(1)
      expect(audits[0]!.overallScore).toBe(7.5)
      expect(audits[0]!.pages).toHaveLength(1)
      expect(audits[0]!.recommendations).toEqual(['Improve FAQ section'])
    })
  })

  describe('getAudit', () => {
    it('returns null for non-existent audit', async () => {
      seedCompany()
      const result = await service.getAudit('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getRecommendations', () => {
    it('returns recommendations with parsed JSON fields', async () => {
      seedCompany()
      seedRun('run_1')

      sqliteDb.sqliteRaw.run(
        `INSERT INTO recommendations (id, run_id, company_id, visibility_gaps, source_opportunities, competitor_insights, summary, model, cost_usd, created_at)
         VALUES ('rec_1', 'run_1', 'co_1', ?, ?, ?, 'Test summary', 'gpt-5.4', 0.03, ?)`,
        [
          JSON.stringify([{ topic: 'SEO', queries: ['best crm'] }]),
          JSON.stringify([{ domain: 'g2.com', citationCount: 5 }]),
          JSON.stringify([{ competitor: 'Rival', domain: 'rival.com' }]),
          now,
        ],
      )

      const result = await service.getRecommendations('run_1')
      expect(result).not.toBeNull()
      expect(result!.summary).toBe('Test summary')
      expect(result!.visibilityGaps).toHaveLength(1)
      expect(result!.sourceOpportunities).toHaveLength(1)
      expect(result!.competitorInsights).toHaveLength(1)
    })

    it('returns null when no recommendations exist for run', async () => {
      seedCompany()
      seedRun('run_1')

      const result = await service.getRecommendations('run_1')
      expect(result).toBeNull()
    })
  })
})
