import chalk from 'chalk'

const ART_LINES = [
  ' ██████   ██████   ██████  ███████ ███████',
  '██       ██    ██ ██    ██ ██      ██     ',
  '██   ███ ██    ██ ██    ██ ███████ █████  ',
  '██    ██ ██    ██ ██    ██      ██ ██     ',
  ' ██████   ██████   ██████  ███████ ███████',
  '',
  '██     ██  ██████  ██████  ██   ██ ███████',
  '██     ██ ██    ██ ██   ██ ██  ██  ██     ',
  '██  █  ██ ██    ██ ██████  █████   ███████',
  '██ ███ ██ ██    ██ ██   ██ ██  ██       ██',
  ' ███ ███   ██████  ██   ██ ██   ██ ███████',
]

interface RGB {
  r: number
  g: number
  b: number
}

function lerp(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  }
}

const GRADIENT_STOPS: RGB[] = [
  { r: 0, g: 230, b: 180 },
  { r: 60, g: 140, b: 255 },
  { r: 160, g: 80, b: 255 },
]

function gradientLine(line: string, row: number, totalRows: number): string {
  const len = line.length
  if (len === 0) return ''

  const rowShift = (row / totalRows) * 0.3

  return [...line]
    .map((ch, i) => {
      if (ch === ' ') return ch
      const t = Math.min(1, Math.max(0, i / (len - 1) + rowShift))
      const segLen = GRADIENT_STOPS.length - 1
      const segIndex = Math.min(Math.floor(t * segLen), segLen - 1)
      const segT = t * segLen - segIndex
      const color = lerp(
        GRADIENT_STOPS[segIndex]!,
        GRADIENT_STOPS[segIndex + 1]!,
        segT,
      )
      return chalk.rgb(color.r, color.g, color.b)(ch)
    })
    .join('')
}

export function getBanner(): string {
  if (!process.stdout.isTTY) return ''

  const art = ART_LINES.map((line, i) => gradientLine(line, i, ART_LINES.length)).join('\n')
  const tagline = chalk.dim('  Answer Engine Optimization Toolkit')
  return `\n${art}\n${tagline}\n`
}
