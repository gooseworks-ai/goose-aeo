import { describe, expect, it } from 'vitest'
import { startMCPServer } from './server.js'

describe('mcp server module', () => {
  it('exports startMCPServer', () => {
    expect(typeof startMCPServer).toBe('function')
  })
})
