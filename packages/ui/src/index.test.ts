import { describe, expect, it } from 'vitest'
import { AEODashboard } from './index.js'

describe('@goose-aeo/ui exports', () => {
  it('exports AEODashboard component', () => {
    expect(typeof AEODashboard).toBe('function')
  })
})
