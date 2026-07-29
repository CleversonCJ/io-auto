"use client";

type RealtimeEvent = {
    type: "conversation.changed" | "message.changed" | "crm.state.changed" | "realtime.pong" | string;
    companyId?: string | null;
    conversationId?: string | null;
    até: string | null;
};

type RealtimeListener = (event: RealtimeEvent) => void;

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectDelay = 1000;
let heartbeatTimer: number | null = null;
let pongTimeoutTimer: number | null = null;
const listeners = new Set<RealtimeListener>();
let isConnecting = false;

function isLoopbackHost(hostname: string) {
    return hostname === "localhost"
        || hostname === "127.0.0.1"
        || hostname === "0.0.0.0"
        || hostname === "::1";
}

function toWebSocketOrigin(url: URL) {
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}`;
}

function resolveWsBase() {
    if (typeof window === "undefined") return "";

    const currentUrl = new URL(window.location.href);
    const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE?.trim();

    if (configuredApiBase) {
        try {
            const configuredUrl = new URL(configuredApiBase, currentUrl.origin);
            const currentIsPublicHost = !isLoopbackHost(currentUrl.hostname);
            const configuredIsLoopback = isLoopbackHost(configuredUrl.hostname);

            // Ignore baked localhost values when the app is running on a public host.
            if (!(currentIsPublicHost && configuredIsLoopback)) {
                return toWebSocketOrigin(configuredUrl);
            }
        } catch {
            // Ignore invalid configured URLs and keep falling back.
        }
    }

    if (!isLoopbackHost(currentUrl.hostname) && currentUrl.hostname.startsWith("app.")) {
        return `${currentUrl.protocol === "https:" ? "wss" : "ws"}://api.${currentUrl.hostname.slice(4)}`;
    }

    if (isLoopbackHost(currentUrl.hostname) && currentUrl.port === "3000") {
        return `${currentUrl.protocol === "https:" ? "wss" : "ws"}://${currentUrl.hostname}:8080`;
    }

    return toWebSocketOrigin(currentUrl);
}

async function getAccessToken() {
    const res = await fetch("/api/realtime/token", { cache: "no-store" });
    if (!res.ok) throw new Error("Sem token realtime.");
    const data = (await res.json().catch(() => null)) as { accessToken?: string } | null;
    if (!data?.accessToken) throw new Error("Token realtime inválido.");
    return data.accessToken;
}

function stopHeartbeat() {
    if (heartbeatTimer != null) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}

function stopPongTimeout() {
    if (pongTimeoutTimer != null) {
        window.clearTimeout(pongTimeoutTimer);
        pongTimeoutTimer = null;
    }
}

function sendHeartbeat(ws: WebSocket) {
    if (socket !== ws || ws.readyState !== WebSocket.OPEN) {
        stopPongTimeout();
        return;
    }
    stopPongTimeout();
    try {
        ws.send("ping");
        pongTimeoutTimer = window.setTimeout(() => {
            if (socket === ws && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.close();
                } catch {
                    // Ignora falhas ao forcar reconexao.
                }
            }
        }, 8000);
    } catch {
        stopPongTimeout();
        try {
            ws.close();
        } catch {
            // Ignora falhas ao encerrar conexao quebrada.
        }
    }
}

function startHeartbeat(ws: WebSocket) {
    stopHeartbeat();
    sendHeartbeat(ws);
    heartbeatTimer = window.setInterval(() => {
        if (socket !== ws || ws.readyState !== WebSocket.OPEN) {
            stopHeartbeat();
            stopPongTimeout();
            return;
        }
        sendHeartbeat(ws);
    }, 12000);
}

function scheduleReconnect() {
    if (listeners.size === 0) return;
    if (reconnectTimer != null) return;
    reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 15000);
}

async function connect() {
    if (typeof window === "undefined" || isConnecting || socket?.readyState === WebSocket.OPEN) return;
    isConnecting = true;
    try {
        const base = resolveWsBase();
        if (!base) return;
        const token = await getAccessToken();
        const ws = new WebSocket(`${base}/ws/realtime?token=${encodeURIComponent(token)}`);
        socket = ws;
        ws.onopen = () => {
            reconnectDelay = 1000;
            startHeartbeat(ws);
        };
        ws.onmessage = (message) => {
            try {
                const event = JSON.parse(String(message.data ?? "{}")) as RealtimeEvent;
                if (event.type === "realtime.pong") {
                    stopPongTimeout();
                    return;
                }
                for (const listener of listeners) listener(event);
            } catch {
                // ignora payload invalido
            }
        };
        ws.onerror = () => {
            ws.close();
        };
        ws.onclose = () => {
            stopHeartbeat();
            stopPongTimeout();
            if (socket === ws) socket = null;
            scheduleReconnect();
        };
    } catch {
        scheduleReconnect();
    } finally {
        isConnecting = false;
    }
}

export function subscribeRealtime(listener: RealtimeListener) {
    listeners.add(listener);
    void connect();
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            stopHeartbeat();
            stopPongTimeout();
            if (reconnectTimer != null) {
                window.clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
                socket.close();
            }
            socket = null;
        }
    };
}
