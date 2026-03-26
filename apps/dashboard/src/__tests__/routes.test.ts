import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Ensures that every API endpoint the UI expects is registered in server.ts.
 *
 * This prevents the bug where UI pages fetch an endpoint that doesn't exist,
 * causing requests to fall through to the HTML catch-all and resulting in
 * "Unexpected token '<'" JSON parse errors.
 */

const serverSource = readFileSync(resolve(__dirname, '../server.ts'), 'utf8')

// All API paths fetched by the UI (extracted from page components)
const requiredRoutes = [
  // Fetched by use-dashboard-data.ts hook (on every page load)
  { method: 'get', path: '/api/status' },
  { method: 'get', path: '/api/runs' },
  { method: 'get', path: '/api/queries' },
  { method: 'get', path: '/api/costs' },

  // overview-page.tsx
  { method: 'get', path: '/api/trends' },
  { method: 'get', path: '/api/runs/:id/metrics' },
  { method: 'get', path: '/api/runs/:id/competitors' },

  // query-page.tsx
  { method: 'get', path: '/api/query-visibility' },

  // responses-page.tsx
  { method: 'get', path: '/api/runs/:id/results' },

  // citation-page.tsx
  { method: 'get', path: '/api/runs/:id/citations' },

  // recommendations-page.tsx
  { method: 'get', path: '/api/runs/:id/recommendations' },

  // audit-page.tsx
  { method: 'get', path: '/api/audits' },
  { method: 'get', path: '/api/audits/:id' },

  // runs-page.tsx / diff
  { method: 'get', path: '/api/runs/:id' },
  { method: 'get', path: '/api/diff' },
]

describe('server route coverage', () => {
  for (const route of requiredRoutes) {
    it(`registers ${route.method.toUpperCase()} ${route.path}`, () => {
      // Normalize the path for regex matching in the source
      // Express paths like /api/runs/:id become app.get('/api/runs/:id' in source
      const escaped = route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`app\\.${route.method}\\s*\\(\\s*['"\`]${escaped}['"\`]`)

      expect(
        pattern.test(serverSource),
        `Missing route: app.${route.method}('${route.path}') not found in server.ts`,
      ).toBe(true)
    })
  }
})
