import nodemailer from 'nodemailer'
import { and, desc, eq, isNull, lt } from 'drizzle-orm'
import { runMetrics, runs } from '../../db/schema.js'
import type { AEOContext } from '../../context.js'
import type { AlertEvent } from '../../types/index.js'

const METRIC_THRESHOLDS: Record<AlertEvent['metric'], number> = {
  visibility_rate: 0.1,
  avg_prominence_score: 1.0,
  share_of_voice: 0.05,
}

interface AlertDispatchResult {
  runId: string
  previousRunId: string | null
  alerts: AlertEvent[]
  sentToSlack: boolean
  sentToEmail: boolean
}

const formatAlertLine = (alert: AlertEvent): string => {
  const pct = (value: number): string => `${(value * 100).toFixed(2)}%`
  if (alert.metric === 'avg_prominence_score') {
    return `- ${alert.metric}: ${alert.previous.toFixed(2)} -> ${alert.current.toFixed(2)} (drop ${alert.drop.toFixed(2)} > threshold ${alert.threshold.toFixed(2)})`
  }

  return `- ${alert.metric}: ${pct(alert.previous)} -> ${pct(alert.current)} (drop ${pct(alert.drop)} > threshold ${pct(alert.threshold)})`
}

export const computeAlertEvents = (args: {
  runId: string
  previousRunId: string
  previousMetrics: Record<string, number>
  currentMetrics: Record<string, number>
  thresholds: Record<AlertEvent['metric'], number>
}): AlertEvent[] => {
  const watchedMetrics: AlertEvent['metric'][] = [
    'visibility_rate',
    'avg_prominence_score',
    'share_of_voice',
  ]

  const alerts: AlertEvent[] = []
  for (const metric of watchedMetrics) {
    const previous = args.previousMetrics[metric]
    const current = args.currentMetrics[metric]
    if (previous === undefined || current === undefined) {
      continue
    }

    const drop = previous - current
    const threshold = args.thresholds[metric]
    if (drop > threshold) {
      alerts.push({
        metric,
        previous,
        current,
        drop,
        threshold,
        runId: args.runId,
        previousRunId: args.previousRunId,
      })
    }
  }

  return alerts
}

export class AlertsService {
  constructor(private readonly ctx: AEOContext) {}

  private metricMap = async (runId: string): Promise<Record<string, number>> => {
    const metrics = await this.ctx.sqliteDb.db
      .select({ metric: runMetrics.metric, value: runMetrics.value })
      .from(runMetrics)
      .where(and(eq(runMetrics.runId, runId), isNull(runMetrics.provider)))

    return metrics.reduce<Record<string, number>>((acc, row) => {
      acc[row.metric] = row.value
      return acc
    }, {})
  }

  evaluate = async (runId: string): Promise<{ previousRunId: string | null; alerts: AlertEvent[] }> => {
    const [currentRun] = await this.ctx.sqliteDb.db
      .select()
      .from(runs)
      .where(eq(runs.id, runId))
      .limit(1)

    if (!currentRun) {
      throw new Error(`Run ${runId} not found for alert evaluation.`)
    }

    const [previousRun] = await this.ctx.sqliteDb.db
      .select()
      .from(runs)
      .where(and(eq(runs.status, 'complete'), lt(runs.startedAt, currentRun.startedAt)))
      .orderBy(desc(runs.startedAt))
      .limit(1)

    if (!previousRun) {
      return {
        previousRunId: null,
        alerts: [],
      }
    }

    const currentMetrics = await this.metricMap(runId)
    const previousMetrics = await this.metricMap(previousRun.id)

    const configured = this.ctx.config.alerts
    const thresholds: Record<AlertEvent['metric'], number> = {
      visibility_rate: configured?.visibilityRateDrop ?? METRIC_THRESHOLDS.visibility_rate,
      avg_prominence_score: configured?.prominenceScoreDrop ?? METRIC_THRESHOLDS.avg_prominence_score,
      share_of_voice: configured?.shareOfVoiceDrop ?? METRIC_THRESHOLDS.share_of_voice,
    }

    const alerts = computeAlertEvents({
      runId,
      previousRunId: previousRun.id,
      previousMetrics,
      currentMetrics,
      thresholds,
    })

    return {
      previousRunId: previousRun.id,
      alerts,
    }
  }

  dispatch = async (runId: string): Promise<AlertDispatchResult> => {
    const evaluated = await this.evaluate(runId)
    if (evaluated.alerts.length === 0) {
      return {
        runId,
        previousRunId: evaluated.previousRunId,
        alerts: [],
        sentToSlack: false,
        sentToEmail: false,
      }
    }

    const body = [
      `Goose AEO alerts for run ${runId}`,
      `Compared against ${evaluated.previousRunId}`,
      '',
      ...evaluated.alerts.map(formatAlertLine),
    ].join('\n')

    let sentToSlack = false
    let sentToEmail = false

    const slackWebhook = process.env.GOOSE_AEO_ALERT_SLACK_WEBHOOK_URL
    if (slackWebhook) {
      try {
        const response = await fetch(slackWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: body }),
        })
        sentToSlack = response.ok
      } catch {
        sentToSlack = false
      }
    }

    const smtpHost = process.env.GOOSE_AEO_SMTP_HOST
    const smtpPort = process.env.GOOSE_AEO_SMTP_PORT
    const smtpUser = process.env.GOOSE_AEO_SMTP_USER
    const smtpPass = process.env.GOOSE_AEO_SMTP_PASS
    const emailTo = process.env.GOOSE_AEO_ALERT_EMAIL_TO
    const emailFrom = process.env.GOOSE_AEO_ALERT_EMAIL_FROM

    if (smtpHost && smtpPort && smtpUser && smtpPass && emailTo && emailFrom) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(smtpPort),
          secure: Number(smtpPort) === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        })

        await transporter.sendMail({
          from: emailFrom,
          to: emailTo,
          subject: `Goose AEO Alerts - run ${runId}`,
          text: body,
        })

        sentToEmail = true
      } catch {
        sentToEmail = false
      }
    }

    return {
      runId,
      previousRunId: evaluated.previousRunId,
      alerts: evaluated.alerts,
      sentToSlack,
      sentToEmail,
    }
  }
}
