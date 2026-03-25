export const colors = {
  background: '#f2f1f0',
  card: '#ffffff',
  foreground: '#0c0a09',
  muted: '#78716c',
  border: '#e7e5e4',
  primary: '#1c1917',
  secondary: '#f5f5f4',
  destructive: '#dc2626',
  success: '#16a34a',
  blue: '#0284c7',
  chart: [
    '#F472B6', // pink
    '#A78BFA', // purple
    '#FB923C', // orange
    '#60A5FA', // blue
    '#34D399', // green
    '#F87171', // red
    '#FBBF24', // yellow
    '#818CF8', // indigo
    '#2DD4BF', // teal
    '#E879F9', // fuchsia
  ] as readonly string[],
  sidebarBg: '#f2f1f0',
  sidebarActive: 'rgba(231, 229, 228, 0.75)',
  tableHeaderBg: '#fafaf9',
} as const

export type ThemeColor = keyof typeof colors
