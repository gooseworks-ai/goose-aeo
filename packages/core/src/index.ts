export { AEOClient, type AEOClientOptions } from './aeo-client.js'
export { initProject, bootstrapDomainContext, type InitOptions, type InitResult } from './services/init-service.js'
export { loadConfig, saveConfig, makeDefaultConfig, DEFAULT_CONFIG_FILE } from './config/load-config.js'
export { loadPricingConfig, DEFAULT_PRICING } from './config/pricing.js'
export { estimateRunCost } from './services/runs/estimate.js'
export { DashboardService } from './services/dashboard/dashboard-service.js'
export type {
  GooseAEOConfig,
  RunEstimate,
  RunSummary,
  RunCreateOptions,
  AnalysisInput,
  AnalyzeSummary,
  ReportResult,
  CostsResult,
  StatusResult,
  DiffResult,
  ProviderId,
  DashboardRunRecord,
  DashboardResultRecord,
} from './types/index.js'
