import { describe, expect, it } from 'vitest'
import { computeAlertEvents } from './alerts-service.js'

describe('computeAlertEvents', () => {
  it('emits alert when threshold is exceeded', () => {
    const alerts = computeAlertEvents({
      runId: 'run_new',
      previousRunId: 'run_old',
      previousMetrics: {
        visibility_rate: 0.7,
        avg_prominence_score: 6,
        share_of_voice: 0.5,
      },
      currentMetrics: {
        visibility_rate: 0.5,
        avg_prominence_score: 5.5,
        share_of_voice: 0.42,
      },
      thresholds: {
        visibility_rate: 0.1,
        avg_prominence_score: 1,
        share_of_voice: 0.05,
      },
    })

    expect(alerts.map((alert) => alert.metric)).toEqual(['visibility_rate', 'share_of_voice'])
  })
})
