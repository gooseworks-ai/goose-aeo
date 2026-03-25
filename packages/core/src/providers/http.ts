export const fetchJson = async <T>(input: string, init: RequestInit, timeoutMs = 60_000): Promise<T> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`HTTP ${response.status}: ${body}`)
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}
