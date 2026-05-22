const DEFAULT_LANDING_PUBLIC_URL = "https://ioauto.com.br";

function normalizeBaseUrl(raw?: string) {
    const value = (raw ?? "").trim();
    if (!value) return DEFAULT_LANDING_PUBLIC_URL;
    try {
        const parsed = new URL(value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`);
        if (!parsed.hostname) return DEFAULT_LANDING_PUBLIC_URL;
        if (isLocalHost(parsed.hostname)) return DEFAULT_LANDING_PUBLIC_URL;
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return DEFAULT_LANDING_PUBLIC_URL;
    }
}

function isLocalHost(hostname: string) {
    const host = hostname.trim().toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1";
}

export function normalizeLandingCheckoutUrl(raw?: string | null) {
    const normalized = (raw ?? "").trim();
    if (!normalized) return "";

    const publicBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_LANDING_PUBLIC_URL);
    try {
        const parsed = new URL(normalized);
        if (!isLocalHost(parsed.hostname)) return parsed.toString();
        return `${publicBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        if (normalized.startsWith("/")) return `${publicBase}${normalized}`;
        return `${publicBase}/${normalized}`;
    }
}
