import { createContext, type AEOContext } from './context.js'
import { initProject, type InitOptions } from './services/init-service.js'
import { QueryService } from './services/queries/query-service.js'
import { RunService } from './services/runs/run-service.js'
import { AnalysisService } from './services/analysis-service.js'
import { ReportService } from './services/reports/report-service.js'
import { DiffService } from './services/diff/diff-service.js'
import { CostsService } from './services/costs/costs-service.js'
import { StatusService } from './services/status/status-service.js'
import { DashboardService } from './services/dashboard/dashboard-service.js'
import { AuditService } from './services/audit/audit-service.js'
import { RecommendationService } from './services/recommendations/recommendation-service.js'
import type { AnalysisInput, AuditInput, AuditResult, DiffResult, RecommendationResult, ReportResult } from './types/index.js'

export interface AEOClientOptions {
  cwd?: string
  configPath?: string
  pricingPath?: string
}

export class AEOClient {
  readonly context: AEOContext
  readonly queries: QueryService
  readonly runs: RunService
  readonly analysis: AnalysisService
  readonly reports: ReportService
  readonly diffService: DiffService
  readonly costsService: CostsService
  readonly statusService: StatusService
  readonly dashboardService: DashboardService
  readonly auditService: AuditService
  readonly recommendationService: RecommendationService

  private constructor(context: AEOContext) {
    this.context = context
    this.queries = new QueryService(this.context)
    this.runs = new RunService(this.context)
    this.analysis = new AnalysisService(this.context)
    this.reports = new ReportService(this.context)
    this.diffService = new DiffService(this.context)
    this.costsService = new CostsService(this.context)
    this.statusService = new StatusService(this.context)
    this.dashboardService = new DashboardService(this.context)
    this.auditService = new AuditService(this.context)
    this.recommendationService = new RecommendationService(this.context)
  }

  static create = async (options: AEOClientOptions = {}): Promise<AEOClient> => {
    const context = await createContext({
      cwd: options.cwd ?? process.cwd(),
      configPath: options.configPath,
      pricingPath: options.pricingPath,
    })
    return new AEOClient(context)
  }

  static init = async (options: InitOptions) => {
    return initProject(options)
  }

  analyze = async (input?: AnalysisInput) => {
    return this.analysis.analyze(input)
  }

  report = async (args: { runId?: string; compareRunId?: string } = {}): Promise<ReportResult> => {
    return this.reports.create(args)
  }

  diff = async (run1: string, run2: string): Promise<DiffResult> => {
    return this.diffService.compare(run1, run2)
  }

  costs = async (last?: number) => {
    return this.costsService.list(last)
  }

  status = async () => {
    return this.statusService.get()
  }

  dashboard = {
    runs: (args?: { limit?: number; offset?: number }) => this.dashboardService.getRuns(args),
    run: (runId: string) => this.dashboardService.getRun(runId),
    metrics: (runId: string) => this.dashboardService.getRunMetrics(runId),
    results: (args: { runId: string; provider?: string; queryId?: string; limit?: number; offset?: number }) =>
      this.dashboardService.getRunResults(args),
    queries: () => this.dashboardService.getQueries(),
    queryVisibility: () => this.dashboardService.getQueryVisibility(),
    competitors: (runId: string) => this.dashboardService.getCompetitors(runId),
    citations: (runId: string) => this.dashboardService.getCitations(runId),
    trends: (metric: string, last: number) => this.dashboardService.getTrends(metric, last),
    audits: () => this.dashboardService.getAudits(),
    audit: (auditId: string) => this.dashboardService.getAudit(auditId),
    recommendations: (runId: string) => this.dashboardService.getRecommendations(runId),
  }

  audit = async (input?: AuditInput): Promise<AuditResult> => {
    return this.auditService.run(input)
  }

  recommend = async (): Promise<RecommendationResult> => {
    return this.recommendationService.generate()
  }

  close = (): void => {
    this.context.sqliteDb.close()
  }
}
