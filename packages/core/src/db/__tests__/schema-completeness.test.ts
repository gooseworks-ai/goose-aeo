import { describe, expect, it } from 'vitest'
import * as schema from '../schema.js'

/**
 * Ensures every table defined in the Drizzle schema is also created
 * in the raw CREATE_TABLES_SQL block in client.ts.
 *
 * This test prevents the bug where a table exists in the ORM schema
 * but is never created in the database, causing "no such table" errors.
 */

// Extract table names from the Drizzle schema exports
const drizzleTableNames = Object.entries(schema)
  .filter(([, value]) => value && typeof value === 'object' && Symbol.for('drizzle:Name') in (value as object))
  .map(([, value]) => (value as unknown as Record<symbol, string>)[Symbol.for('drizzle:Name')])

// We need to import the CREATE_TABLES_SQL indirectly by reading the client module
// Since it's not exported, we test by creating a DB and checking all tables exist
import { createSqliteDb } from '../client.js'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unlinkSync, existsSync } from 'node:fs'

describe('schema completeness', () => {
  it('all Drizzle schema tables exist in the database after init', async () => {
    const dbPath = join(tmpdir(), `goose-aeo-test-${Date.now()}.db`)

    try {
      const db = await createSqliteDb(dbPath)

      // Query sqlite_master for all table names
      const result = db.sqliteRaw.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      const dbTableNames = (result[0]?.values ?? []).map((row) => String(row[0]))

      for (const tableName of drizzleTableNames) {
        expect(dbTableNames, `Table "${tableName}" is defined in schema.ts but not created in client.ts`).toContain(
          tableName,
        )
      }

      db.close()
    } finally {
      if (existsSync(dbPath)) unlinkSync(dbPath)
    }
  })

  it('exports at least the core tables', () => {
    const expectedTables = [
      'companies',
      'competitors',
      'queries',
      'runs',
      'provider_responses',
      'analysis_results',
      'run_metrics',
      'audits',
      'recommendations',
    ]

    for (const name of expectedTables) {
      expect(drizzleTableNames, `Expected table "${name}" in Drizzle schema`).toContain(name)
    }
  })
})
