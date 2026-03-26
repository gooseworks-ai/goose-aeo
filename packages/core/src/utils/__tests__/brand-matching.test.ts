import { describe, it, expect } from 'vitest'
import { buildAliases, findBrandMentions } from '../brand-matching.js'

describe('buildAliases', () => {
  it('deduplicates name and domain prefix', () => {
    const aliases = buildAliases('n8n', 'n8n.io')
    expect(aliases).toEqual(['n8n', 'n8n.io'])
  })

  it('includes domain prefix when different from name', () => {
    const aliases = buildAliases('Atlassian', 'atlassian.com')
    expect(aliases).toEqual(['Atlassian', 'atlassian.com'])
  })

  it('includes extra aliases', () => {
    const aliases = buildAliases('AWS', 'aws.amazon.com', ['Amazon Web Services'])
    expect(aliases).toContain('Amazon Web Services')
    expect(aliases).toContain('AWS')
    expect(aliases).toContain('aws.amazon.com')
    // 'aws' is deduped with 'AWS' (case-insensitive dedup)
    expect(aliases.length).toBe(3)
  })

  it('filters empty strings', () => {
    const aliases = buildAliases('Test', 'test.com', ['', '  '])
    expect(aliases.every((a) => a.trim().length > 0)).toBe(true)
  })
})

describe('findBrandMentions', () => {
  it('finds short brand name case-sensitively', () => {
    const result = findBrandMentions('Try n8n for automation', ['n8n'])
    expect(result.found).toBe(true)
    expect(result.matchCount).toBe(1)
    expect(result.matchedTerms).toEqual(['n8n'])
  })

  it('rejects wrong case for short brand names', () => {
    const result = findBrandMentions('Try N8N for automation', ['n8n'])
    expect(result.found).toBe(false)
  })

  it('finds medium brand name case-insensitively', () => {
    const result = findBrandMentions('Try ATLASSIAN today', ['Atlassian'])
    expect(result.found).toBe(true)
    expect(result.matchCount).toBe(1)
  })

  it('finds domain-format aliases', () => {
    const result = findBrandMentions('Visit n8n.io for more info', ['n8n.io'])
    expect(result.found).toBe(true)
    expect(result.matchCount).toBe(1)
  })

  it('respects word boundaries for short names', () => {
    const result = findBrandMentions('information about systems', ['ion'])
    expect(result.found).toBe(false)
  })

  it('respects word boundaries for medium names', () => {
    const result = findBrandMentions('organizational chart', ['organ'])
    expect(result.found).toBe(false)
  })

  it('returns not found when brand is absent', () => {
    const result = findBrandMentions('Try Zapier for automation', ['n8n', 'n8n.io'])
    expect(result.found).toBe(false)
    expect(result.matchCount).toBe(0)
    expect(result.matchedTerms).toEqual([])
    expect(result.firstMatchIndex).toBeNull()
  })

  it('counts multiple occurrences', () => {
    const result = findBrandMentions('n8n is great. Use n8n for workflows. n8n rocks.', ['n8n'])
    expect(result.found).toBe(true)
    expect(result.matchCount).toBe(3)
  })

  it('tracks first match index', () => {
    const result = findBrandMentions('Hello n8n world', ['n8n'])
    expect(result.firstMatchIndex).toBe(6)
  })

  it('handles special regex characters in brand names', () => {
    // C++ is 3 chars so uses word-boundary matching; \b doesn't work after +
    // but domain-like or longer names with special chars still work
    const result = findBrandMentions('Visit auth0.com today', ['auth0.com'])
    expect(result.found).toBe(true)
  })

  it('matches across multiple aliases', () => {
    const result = findBrandMentions('Check n8n.io or use n8n directly', ['n8n', 'n8n.io'])
    expect(result.found).toBe(true)
    expect(result.matchedTerms).toContain('n8n')
    expect(result.matchedTerms).toContain('n8n.io')
  })
})
