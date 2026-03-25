import { loadConfig, saveConfig } from '../../config/load-config.js'
import type { AEOContext } from '../../context.js'
import type { ScheduleStatus } from '../../types/index.js'

const DAILY_CRON = '0 9 * * *'
const WEEKLY_CRON = '0 9 * * 1'

export const normalizeCron = (value: string): string => {
  const parts = value.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression '${value}'. Expected 5 fields.`)
  }

  return parts.join(' ')
}

export const scheduleToCron = (schedule: string | null | undefined): string | null => {
  if (!schedule) {
    return null
  }

  if (schedule === 'daily') {
    return DAILY_CRON
  }

  if (schedule === 'weekly') {
    return WEEKLY_CRON
  }

  return normalizeCron(schedule)
}

export class ScheduleService {
  constructor(private readonly ctx: AEOContext) {}

  private toStatus = (schedule: string | null): ScheduleStatus => {
    const cron = scheduleToCron(schedule)
    const suggestedCronCommand = cron
      ? `${cron} cd \"${this.ctx.cwd}\" && npx goose-aeo run --confirm && npx goose-aeo analyze`
      : null

    return {
      schedule,
      cron,
      suggestedCronCommand,
    }
  }

  private persist = (schedule: string | null): ScheduleStatus => {
    const config = loadConfig(this.ctx.cwd, this.ctx.configPath)
    config.schedule = schedule
    saveConfig(this.ctx.cwd, config, this.ctx.configPath)
    this.ctx.config.schedule = schedule

    return this.toStatus(schedule)
  }

  setCron = (cron: string): ScheduleStatus => {
    const normalizedCron = normalizeCron(cron)
    return this.persist(normalizedCron)
  }

  setFrequency = (frequency: 'daily' | 'weekly'): ScheduleStatus => {
    return this.persist(frequency)
  }

  remove = (): ScheduleStatus => {
    return this.persist(null)
  }

  status = (): ScheduleStatus => {
    return this.toStatus(this.ctx.config.schedule ?? null)
  }
}
