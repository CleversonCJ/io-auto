"use client";

import { useEffect, useRef } from "react";

const SESSION_CHECK_INTERVAL_MS = 45_000;
const LOGOUT_BROADCAST_STORAGE_KEY = "io.auth.logout";
const IGNORED_API_PATHS = new Set([
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/me",
    "/api/auth/refresh",
]);
const FETCH_SHIM_MARKER = "__ioauto_fetch_credentials_shim__";

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
    const isCheckingRef = useRef(false);
    const isLoggingOutRef = useRef(false);

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
                    await logoutSession();
                }
            } catch {
                // Falhas de rede nao devem derrubar a sessao sozinhas.
            } finally {
                isCheckingRef.current = false;
            }
        }

        window.fetch = async (...args: Parameters<typeof window.fetch>) => {
            const response = await originalFetch(...args);

            if (response.status === 401 && isProtectedApiRequest(args[0])) {
                void checkSession();
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

        void checkSession();

        const intervalId = window.setInterval(() => {
            if (document.hidden) return;
            void checkSession();
        }, SESSION_CHECK_INTERVAL_MS);

        window.addEventListener("focus", handleFocus);
        window.addEventListener("storage", handleStorage);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.fetch = originalFetch;
            window.clearInterval(intervalId);
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("storage", handleStorage);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return null;
}
