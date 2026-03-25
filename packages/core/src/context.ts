import path from 'node:path'
import { createSqliteDb, type SqliteDb } from './db/client.js'
import { loadConfig, resolveDbPath } from './config/load-config.js'
import { loadPricingConfig } from './config/pricing.js'
import type { GooseAEOConfig, PricingConfig } from './types/index.js'

export interface AEOContext {
  cwd: string
  configPath?: string
  pricingPath?: string
  config: GooseAEOConfig
  dbPath: string
  pricing: PricingConfig
  sqliteDb: SqliteDb
}

export const createContext = async (args: {
  cwd: string
  configPath?: string
  pricingPath?: string
}): Promise<AEOContext> => {
  const cwd = path.resolve(args.cwd)
  const config = loadConfig(cwd, args.configPath)
  const dbPath = resolveDbPath(cwd, config)
  const pricing = loadPricingConfig(cwd, args.pricingPath)
  const sqliteDb = await createSqliteDb(dbPath)

  return {
    cwd,
    configPath: args.configPath,
    pricingPath: args.pricingPath,
    config,
    dbPath,
    pricing,
    sqliteDb,
  }
}
