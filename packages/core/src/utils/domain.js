export const normalizeDomain = (domain) => {
    return domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '');
};
export const domainFromUrl = (url) => {
    try {
        return normalizeDomain(new URL(url).hostname);
    }
    catch {
        return normalizeDomain(url);
    }
};
