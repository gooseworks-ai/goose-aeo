import chalk from 'chalk'

const GOOSE_LINES = [
  '       ___        ',
  '      (o >        ',
  '      / |\\       ',
  '     /  | \\      ',
  '    /___|__\\     ',
  '    |  ___  |     ',
  '    | |   | |     ',
  '    |_|   |_|     ',
  '     /     \\     ',
  '    ~       ~     ',
]

const TEXT_LINES = [
  ' ██████   ██████   ██████  ███████ ███████',
  '██       ██    ██ ██    ██ ██      ██     ',
  '██   ███ ██    ██ ██    ██ ███████ █████  ',
  '██    ██ ██    ██ ██    ██      ██ ██     ',
  ' ██████   ██████   ██████  ███████ ███████',
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

function colorGooseLine(line: string): string {
  return [...line]
    .map((ch) => {
      if (ch === ' ') return ch
      if (ch === 'o' || ch === '>') return chalk.rgb(255, 165, 0)(ch) // orange beak/eye
      if (ch === '~') return chalk.rgb(180, 140, 80)(ch) // brown feet
      if (ch === '_' || ch === '|' || ch === '/' || ch === '\\')
        return chalk.rgb(200, 170, 120)(ch) // brown body
      return chalk.white(ch)
    })
    .join('')
}

export function getBanner(): string {
  if (!process.stdout.isTTY) return ''

  const art = TEXT_LINES.map((textLine, i) => {
    const gooseRaw = GOOSE_LINES[i] ?? '                  '
    const gooseColored = colorGooseLine(gooseRaw)
    const textColored = gradientLine(textLine, i, TEXT_LINES.length)
    return gooseColored + ' ' + textColored
  }).join('\n')

  const tagline = chalk.dim('                     Answer Engine Optimization Toolkit')
  return `\n${art}\n${tagline}\n`
}
