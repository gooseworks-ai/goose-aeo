import { randomUUID } from 'node:crypto'

export const nowEpochMs = (): number => Date.now()

export const idWithPrefix = (prefix: string): string => {
  const token = randomUUID().replace(/-/g, '').slice(0, 12)
  return `${prefix}_${token}`
}
