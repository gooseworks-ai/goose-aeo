export const truncate = (value, maxLength) => {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
};
export const sentenceIndexOfMention = (responseText, terms) => {
    const sentences = responseText
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
    const loweredTerms = terms.map((term) => term.toLowerCase());
    const index = sentences.findIndex((sentence) => {
        const loweredSentence = sentence.toLowerCase();
        return loweredTerms.some((term) => loweredSentence.includes(term));
    });
    return index >= 0 ? index : null;
};
