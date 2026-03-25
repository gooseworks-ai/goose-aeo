export const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`
}

export const sentenceIndexOfMention = (responseText: string, terms: string[]): number | null => {
  const sentences = responseText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  const loweredTerms = terms.map((term) => term.toLowerCase())
  const index = sentences.findIndex((sentence) => {
    const loweredSentence = sentence.toLowerCase()
    return loweredTerms.some((term) => loweredSentence.includes(term))
  })

  return index >= 0 ? index : null
}
