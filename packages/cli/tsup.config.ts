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
})
