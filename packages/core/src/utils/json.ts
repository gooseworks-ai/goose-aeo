export const safeJsonParse = <T>(input: string, fallback: T): T => {
  try {
    return JSON.parse(input) as T
  } catch {
    return fallback
  }
}

export const stripCodeFences = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  const withoutStart = trimmed.replace(/^```(?:json)?\s*/i, '')
  return withoutStart.replace(/\s*```$/, '').trim()
}
