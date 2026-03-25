import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import initSqlJs, { type Database } from 'sql.js'
import { drizzle } from 'drizzle-orm/sql-js'
import * as schema from './schema.js'

export interface SqliteDb {
  sqliteRaw: Database
  db: ReturnType<typeof drizzle<typeof schema>>
  dbPath: string
  close: () => void
}

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  config TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  domain TEXT NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS queries (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  text TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  deprecated_at INTEGER
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  status TEXT NOT NULL,
  config_snapshot TEXT NOT NULL,
  query_version INTEGER NOT NULL,
  estimated_cost REAL,
  actual_cost REAL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  error TEXT
);

CREATE TABLE IF NOT EXISTS provider_responses (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  query_id TEXT NOT NULL REFERENCES queries(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  raw_response TEXT NOT NULL,
  sources TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL REFERENCES provider_responses(id),
  run_id TEXT NOT NULL REFERENCES runs(id),
  query_id TEXT NOT NULL REFERENCES queries(id),
  provider TEXT NOT NULL,

  mentioned INTEGER NOT NULL,
  mention_type TEXT,
  total_mentions INTEGER,
  first_mention_sentence INTEGER,

  prominence_score REAL,
  mention_context TEXT,
  list_position INTEGER,
  recommended_as_best INTEGER,

  domain_cited_as_source INTEGER,
  source_position INTEGER,

  competitors_mentioned TEXT,
  our_rank_vs_competitors INTEGER,
  ranked_above TEXT,
  ranked_below TEXT,

  sentiment TEXT,
  sentiment_score REAL,
  sentiment_note TEXT,

  response_type TEXT,
  relevant_excerpt TEXT,

  analysis_model TEXT NOT NULL,
  analysis_input_tokens INTEGER,
  analysis_output_tokens INTEGER,
  analysis_cost_usd REAL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS run_metrics (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  provider TEXT,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  created_at INTEGER NOT NULL
);
`

export const createSqliteDb = async (dbPath: string): Promise<SqliteDb> => {
  mkdirSync(path.dirname(dbPath), { recursive: true })

  const SQL = await initSqlJs()

  let sqliteRaw: Database
  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath)
    sqliteRaw = new SQL.Database(fileBuffer)
  } else {
    sqliteRaw = new SQL.Database()
  }

  sqliteRaw.run('PRAGMA journal_mode = WAL')
  sqliteRaw.run(CREATE_TABLES_SQL)

  const db = drizzle(sqliteRaw, { schema })

  const save = () => {
    const data = sqliteRaw.export()
    const buffer = Buffer.from(data)
    writeFileSync(dbPath, buffer)
  }

  const close = () => {
    save()
    sqliteRaw.close()
  }

  // Persist initial state (table creation) for new databases
  if (!existsSync(dbPath)) {
    save()
  }

  return { sqliteRaw, db, dbPath, close }
}
