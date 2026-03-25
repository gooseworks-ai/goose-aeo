import { statSync } from 'node:fs'

export const fileSizeMb = (filePath: string): number => {
  try {
    const stat = statSync(filePath)
    return Math.round((stat.size / (1024 * 1024)) * 100) / 100
  } catch {
    return 0
  }
}
