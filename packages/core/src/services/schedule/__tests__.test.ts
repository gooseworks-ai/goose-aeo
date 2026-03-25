import { describe, expect, it } from 'vitest'
import { normalizeCron, scheduleToCron } from './schedule-service.js'

describe('schedule helpers', () => {
  it('maps frequency shortcuts to cron', () => {
    expect(scheduleToCron('daily')).toBe('0 9 * * *')
    expect(scheduleToCron('weekly')).toBe('0 9 * * 1')
  })

  it('validates cron shape', () => {
    expect(normalizeCron('0 9 * * 1')).toBe('0 9 * * 1')
    expect(() => normalizeCron('0 9 * *')).toThrow()
  })
})
