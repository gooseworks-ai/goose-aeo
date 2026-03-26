import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { buildDefaultConfig, rawConfigSchema } from './schema.js'
import type { GooseAEOConfig } from '../types/index.js'

export const DEFAULT_CONFIG_FILE = '.goose-aeo.yml'

const toCamelConfig = (raw: ReturnType<typeof rawConfigSchema.parse>): GooseAEOConfig => {
  return {
    domain: raw.domain,
    name: raw.name,
    description: raw.description,
    aliases: raw.aliases,
    competitors: raw.competitors,
    providers: raw.providers,
    analysis: {
      provider: raw.analysis.provider,
      model: raw.analysis.model,
    },
    queryLimit: raw.query_limit,
    dbPath: raw.db_path,
    queriesBackup: raw.queries_backup,
    budgetLimitUsd: raw.budget_limit_usd,
    schedule: raw.schedule,
    alerts: raw.alerts
      ? {
          visibilityRateDrop: raw.alerts.visibility_rate_drop,
          prominenceScoreDrop: raw.alerts.prominence_score_drop,
          shareOfVoiceDrop: raw.alerts.share_of_voice_drop,
        }
      : undefined,
  }
}

const toRawConfig = (config: GooseAEOConfig): unknown => {
  return {
    domain: config.domain,
    name: config.name,
    description: config.description,
    aliases: config.aliases,
    competitors: config.competitors,
    providers: config.providers,
    analysis: config.analysis,
    query_limit: config.queryLimit,
    db_path: config.dbPath,
    queries_backup: config.queriesBackup,
    budget_limit_usd: config.budgetLimitUsd ?? null,
    schedule: config.schedule ?? null,
    alerts: config.alerts
      ? {
          visibility_rate_drop: config.alerts.visibilityRateDrop,
          prominence_score_drop: config.alerts.prominenceScoreDrop,
          share_of_voice_drop: config.alerts.shareOfVoiceDrop,
        }
      : undefined,
  }
}

export const loadConfig = (cwd: string, explicitPath?: string): GooseAEOConfig => {
  const configPath = explicitPath ? path.resolve(cwd, explicitPath) : path.resolve(cwd, DEFAULT_CONFIG_FILE)
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found at ${configPath}. Run 'goose-aeo init' first.`)
  }

  const rawYaml = readFileSync(configPath, 'utf8')
  const parsed = rawConfigSchema.parse(YAML.parse(rawYaml))
  return toCamelConfig(parsed)
}

export const saveConfig = (cwd: string, config: GooseAEOConfig, explicitPath?: string): string => {
  const configPath = explicitPath ? path.resolve(cwd, explicitPath) : path.resolve(cwd, DEFAULT_CONFIG_FILE)
  const raw = toRawConfig(config)
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, YAML.stringify(raw), 'utf8')
  return configPath
}

export const resolveDbPath = (cwd: string, config: GooseAEOConfig): string => {
  return path.resolve(cwd, config.dbPath)
}

export const makeDefaultConfig = (domain: string, name?: string): GooseAEOConfig => {
  const fallbackName = name ?? domain.split('.')[0] ?? 'Company'
  const titleName = fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1)
  return buildDefaultConfig(domain, titleName)
}
