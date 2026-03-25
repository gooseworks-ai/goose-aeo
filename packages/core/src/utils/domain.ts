export const normalizeDomain = (domain: string): string => {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
}

export const domainFromUrl = (url: string): string => {
  try {
    return normalizeDomain(new URL(url).hostname)
  } catch {
    return normalizeDomain(url)
  }
}
