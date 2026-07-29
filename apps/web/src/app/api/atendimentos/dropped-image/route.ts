import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FALLBACK_IMAGE_NAME = "imagem-arrastada";

type DroppedImageBody = {
    url?: string;
};

async function getAccessToken() {
    return (await cookies()).get(ACCESS_COOKIE)?.value;
}

async function refreshAccessToken(apiBase: string) {
    const cookieStore = await cookies();
    const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
    if (!refresh) return null;

    const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!refreshRes.ok) {
        if ([400, 401, 403].includes(refreshRes.status)) {
            cookieStore.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
            cookieStore.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
        }
        return null;
    }

    const data = (await refreshRes.json()) as { accessToken: string; refreshToken: string };
    await setAuthCookies(data.accessToken, data.refreshToken);
    return data.accessToken;
}

async function ensureAuthenticatedSession() {
    const apiBase = getServerApiBase();
    let access: string | null = (await getAccessToken()) ?? null;
    if (access) return access;
    access = await refreshAccessToken(apiBase);
    return access;
}

function sanitizeFileName(value: string) {
    const trimmed = value.trim().replace(/["']/g, "");
    const sanitized = trimmed.replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-").replace(/\s+/g, "-");
    return sanitized.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function getImageExtensionFromContentType(contentType: string | null | undefined) {
    const normalized = String(contentType ?? "").trim().toLowerCase();
    if (!normalized.startsWith("image/")) return "";
    if (normalized === "image/jpeg") return ".jpg";
    if (normalized === "image/svg+xml") return ".svg";
    if (normalized === "image/x-icon") return ".ico";
    return `.${normalized.slice("image/".length).split(";")[0]}`;
}

function inferFileName(url: URL, contentType: string | null) {
    const rawName = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const sanitized = sanitizeFileName(rawName);
    if (sanitized) return sanitized;
    return `${FALLBACK_IMAGE_NAME}${getImageExtensionFromContentType(contentType) || ".png"}`;
}

async function readImageBytes(response: Response) {
    const contentLength = Number(response.headers.get("Content-Length") ?? "0");
    if (contentLength > MAX_IMAGE_BYTES) {
        throw new Error("Imagem muito pesada. Limite: 5 MB.");
    }

    const reader = response.body?.getReader();
    if (!reader) {
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
            throw new Error("Imagem muito pesada. Limite: 5 MB.");
        }
        return new Uint8Array(arrayBuffer);
    }

    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        total += value.byteLength;
        if (total > MAX_IMAGE_BYTES) {
            throw new Error("Imagem muito pesada. Limite: 5 MB.");
        }
        chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

export async function POST(req: Request) {
    const access = await ensureAuthenticatedSession();
    if (!access) {
        return NextResponse.json({ message: "Sessao expirada." }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as DroppedImageBody | null;
    const rawUrl = String(body?.url ?? "").trim();
    if (!rawUrl) {
        return NextResponse.json({ message: "Informe a URL da imagem arrastada." }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        return NextResponse.json({ message: "A origem arrastada nao possui uma URL valida." }, { status: 400 });
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return NextResponse.json({ message: "So e possivel buscar imagens remotas via http ou https." }, { status: 400 });
    }

    let upstream: Response;
    try {
        upstream = await fetch(parsedUrl.toString(), {
            cache: "no-store",
            redirect: "follow",
        });
    } catch {
        return NextResponse.json(
            {
                message:
                    "Nao foi possivel acessar essa imagem arrastada. Se a origem estiver protegida, salve a imagem no computador ou copie e cole no campo da mensagem.",
            },
            { status: 502 }
        );
    }

    if (!upstream.ok) {
        return NextResponse.json(
            {
                message:
                    "Nao foi possivel acessar essa imagem arrastada. Se a origem estiver protegida, salve a imagem no computador ou copie e cole no campo da mensagem.",
            },
            { status: 502 }
        );
    }

    const contentType = upstream.headers.get("Content-Type");
    if (!contentType?.toLowerCase().startsWith("image/")) {
        return NextResponse.json(
            { message: "Conteudos remotos arrastados do navegador sao aceitos automaticamente apenas para imagens. Para videos e documentos, arraste o arquivo do computador." },
            { status: 415 }
        );
    }

    try {
        const bytes = await readImageBytes(upstream);
        const fileName = inferFileName(parsedUrl, contentType);
        return new NextResponse(bytes, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Length": String(bytes.byteLength),
                "Content-Disposition": `inline; filename="${fileName}"`,
                "X-Dropped-Image-Name": fileName,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Nao foi possivel processar a imagem arrastada.";
        const status = message.includes("Limite: 5 MB") ? 413 : 500;
        return NextResponse.json({ message }, { status });
    }
}
