"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const SESSION_CHECK_INTERVAL_MS = 45_000;
const PROACTIVE_REFRESH_INTERVAL_MS = 12 * 60_000;
const LOGOUT_BROADCAST_STORAGE_KEY = "io.auth.logout";
const IGNORED_API_PATHS = new Set([
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/me",
    "/api/auth/refresh",
]);
const FETCH_SHIM_MARKER = "__ioauto_fetch_credentials_shim__";
type RefreshStatus = "refreshed" | "expired" | "unavailable";

function resolveFetchUrl(input: RequestInfo | URL) {
    if (typeof window === "undefined") return null;

    if (typeof input === "string") {
        return new URL(input, window.location.origin);
    }

    if (input instanceof URL) {
        return new URL(input.toString(), window.location.origin);
    }

    return new URL(input.url, window.location.origin);
}

function isProtectedApiRequest(input: RequestInfo | URL) {
    const url = resolveFetchUrl(input);
    if (!url) return false;
    if (url.origin !== window.location.origin) return false;
    if (!url.pathname.startsWith("/api/")) return false;
    return !IGNORED_API_PATHS.has(url.pathname);
}

function isSameOriginApiRequest(input: RequestInfo | URL) {
    const url = resolveFetchUrl(input);
    if (!url) return false;
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
}

function installFetchCredentialsShim() {
    if (typeof window === "undefined") return;

    const markerHost = window as typeof window & {
        [FETCH_SHIM_MARKER]?: boolean;
    };

    if (markerHost[FETCH_SHIM_MARKER]) return;

    const browserFetch = window.fetch.bind(window);

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        if (!isSameOriginApiRequest(input)) {
            return browserFetch(input, init);
        }

        return browserFetch(input, {
            ...init,
            credentials: init?.credentials ?? "include",
        });
    }) as typeof window.fetch;

    markerHost[FETCH_SHIM_MARKER] = true;
}

installFetchCredentialsShim();

export function AuthSessionWatcher() {
    const router = useRouter();
    const isCheckingRef = useRef(false);
    const isLoggingOutRef = useRef(false);
    const refreshPromiseRef = useRef<Promise<RefreshStatus> | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const originalFetch = window.fetch.bind(window);

        async function logoutSession() {
            if (isLoggingOutRef.current) return;
            isLoggingOutRef.current = true;

            try {
                window.localStorage.setItem(LOGOUT_BROADCAST_STORAGE_KEY, String(Date.now()));
            } catch {
                // Ignora indisponibilidade de storage no browser.
            }

            window.location.replace("/api/auth/logout");
        }

        async function refreshSession(): Promise<RefreshStatus> {
            if (refreshPromiseRef.current) {
                return refreshPromiseRef.current;
            }

            const refreshPromise = (async (): Promise<RefreshStatus> => {
                try {
                    const response = await originalFetch("/api/auth/refresh", {
                        method: "POST",
                        cache: "no-store",
                        credentials: "include",
                    });

                    if (response.ok) {
                        router.refresh();
                        return "refreshed";
                    }
                    if ([400, 401, 403].includes(response.status)) {
                        return "expired";
                    }
                    return "unavailable";
                } catch {
                    return "unavailable";
                }
            })();

            refreshPromiseRef.current = refreshPromise;
            try {
                return await refreshPromise;
            } finally {
                if (refreshPromiseRef.current === refreshPromise) {
                    refreshPromiseRef.current = null;
                }
            }
        }

        async function checkSession() {
            if (isCheckingRef.current || isLoggingOutRef.current) return;
            isCheckingRef.current = true;

            try {
                const response = await originalFetch("/api/auth/me", {
                    cache: "no-store",
                    credentials: "include",
                    headers: {
                        "x-io-session-check": "1",
                    },
                });

                if (response.status === 401) {
                    const refreshStatus = await refreshSession();
                    if (refreshStatus === "expired") {
                        await logoutSession();
                        return;
                    }
                    if (refreshStatus === "refreshed") {
                        const retry = await originalFetch("/api/auth/me", {
                            cache: "no-store",
                            credentials: "include",
                            headers: {
                                "x-io-session-check": "1",
                            },
                        });
                        if (retry.status === 401) {
                            await logoutSession();
                        }
                    }
                    return;
                }

                if (response.ok && response.headers.get("x-io-auth-refreshed") === "1") {
                    router.refresh();
                }
            } catch {
                // Falhas de rede nao devem derrubar a sessao sozinhas.
            } finally {
                isCheckingRef.current = false;
            }
        }

        window.fetch = async (...args: Parameters<typeof window.fetch>) => {
            const retryInput = args[0] instanceof Request ? args[0].clone() : args[0];
            const response = await originalFetch(...args);

            if (response.status === 401 && isProtectedApiRequest(args[0])) {
                const refreshStatus = await refreshSession();
                if (refreshStatus === "refreshed") {
                    const retriedResponse = await originalFetch(retryInput, args[1]);
                    if (retriedResponse.status === 401) {
                        void checkSession();
                    }
                    return retriedResponse;
                }
                if (refreshStatus === "expired") {
                    void logoutSession();
                }
            }

            return response;
        };

        const handleFocus = () => {
            void checkSession();
        };

        const handleVisibilityChange = () => {
            if (document.hidden) return;
            void checkSession();
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== LOGOUT_BROADCAST_STORAGE_KEY || !event.newValue || isLoggingOutRef.current) return;
            isLoggingOutRef.current = true;
            window.location.replace("/login");
        };

        // The protected page and its data requests already validate the token.
        // Defer the extra health check so it does not compete with the initial
        // page load for a connection or trigger another simultaneous refresh.
        const initialCheckTimeoutId = window.setTimeout(() => {
            void checkSession();
        }, 1_200);

        const intervalId = window.setInterval(() => {
            if (document.hidden) return;
            void checkSession();
        }, SESSION_CHECK_INTERVAL_MS);
        const proactiveRefreshIntervalId = window.setInterval(() => {
            if (document.hidden || isLoggingOutRef.current) return;
            void refreshSession().then((status) => {
                if (status === "expired") {
                    void logoutSession();
                }
            });
        }, PROACTIVE_REFRESH_INTERVAL_MS);

        window.addEventListener("focus", handleFocus);
        window.addEventListener("storage", handleStorage);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.fetch = originalFetch;
            window.clearTimeout(initialCheckTimeoutId);
            window.clearInterval(intervalId);
            window.clearInterval(proactiveRefreshIntervalId);
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("storage", handleStorage);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [router]);

    return null;
}
