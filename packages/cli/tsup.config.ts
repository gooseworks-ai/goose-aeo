import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: false,
  // Bundle @goose-aeo/core into the output so only one package needs publishing.
  // All other dependencies stay external (installed via package.json).
  noExternal: ['@goose-aeo/core'],
  banner: {
    js: '#!/usr/bin/env node',
  },
  onSuccess: async () => {
    // Copy pre-built dashboard static assets into dist/public so they ship with the CLI package.
    const dashboardPublic = path.resolve('../../apps/dashboard/dist/public')
    const target = path.resolve('dist/public')
    if (existsSync(dashboardPublic)) {
      cpSync(dashboardPublic, target, { recursive: true })
    } else {
      console.warn('[tsup] WARNING: dashboard assets not found at', dashboardPublic, '— dist/public will not be included')
    }
  },
})
