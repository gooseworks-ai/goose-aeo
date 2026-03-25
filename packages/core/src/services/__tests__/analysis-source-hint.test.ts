import { describe, expect, it } from 'vitest'
import { sourceCitationHint } from '../analysis-service.js'

describe('sourceCitationHint', () => {
  it('detects domain and citation position from source payload', () => {
    const sources = JSON.stringify([
      { url: 'https://example.com/a' },
      { url: 'https://athina.ai/docs' },
    ])

    const hint = sourceCitationHint('athina.ai', sources)
    expect(hint.domainCitedAsSource).toBe(true)
    expect(hint.sourcePosition).toBe(2)
  })

  it('handles missing sources', () => {
    const hint = sourceCitationHint('athina.ai', null)
    expect(hint.domainCitedAsSource).toBe(false)
    expect(hint.sourcePosition).toBeNull()
  })
})
