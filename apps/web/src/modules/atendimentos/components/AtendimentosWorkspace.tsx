"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/min";
import type { CountryCode } from "libphonenumber-js";
import {
    Archive,
    ArrowRight,
    ArrowUpDown,
    Check,
    CheckCheck,
    ChevronDown,
    Crop,
    Download,
    Expand,
    FileText,
    Filter,
    ImageIcon,
    MessageCircleMore,
    Mic,
    Move,
    Paperclip,
    Pause,
    Pencil,
    Play,
    Plus,
    RotateCw,
    Rows3,
    Search,
    SendHorizonal,
    Smile,
    Square,
    Tag,
    Trash2,
    Undo2,
    Video,
    Volume2,
    VolumeX,
    X,
} from "lucide-react";
import {
    clearLegacyContactLabelAssignments,
    getLabelTextColor,
    loadContactLabels,
    readLegacyContactLabelAssignments,
    type ContactLabel,
    type ContactLabelAssignments,
} from "@/modules/etiquetas/storage";
import {
    loadCustomAtendimentoClassifications,
    listAtendimentoClassificationCategories,
    listAllAtendimentoClassifications,
    saveCustomAtendimentoClassifications,
    type AtendimentoClassification,
    type ContactConclusionMap,
} from "@/modules/classificacoes/storage";
import { AtendimentoClassificationCategoryIcon } from "@/modules/classificacoes/icons";
import { subscribeRealtime } from "@/core/realtime/client";
import { ChatEmojiPicker } from "@/modules/atendimentos/components/ChatEmojiPicker";

type Message = {
    id: string;
    text: string;
    type: string;
    imageUrl?: string | null;
    stickerUrl?: string | null;
    videoUrl?: string | null;
    audioUrl?: string | null;
    documentUrl?: string | null;
    documentName?: string | null;
    chatId?: string;
    pending?: boolean;
    pendingLabel?: string;
    pendingProgress?: number | null;
    fromMe: boolean;
    at: string;
    atRaw?: string | null;
    status?: string | null;
};

type Chat = {
    id: string;
    phone: string;
    displayPhone: string;
    name: string;
    description: string;
    avatar: string;
    photoUrl?: string | null;
    status: "NEW" | "IN_PROGRESS";
    assignedTeamId?: string | null;
    assignedTeamName?: string | null;
    assignedUserId?: string | null;
    assignedUserName?: string | null;
    teamName?: string | null;
    startedAt?: string | null;
    presenceStatus?: string | null;
    presenceLastSeen?: string | null;
    lastMessage: string;
    lastAt: string;
    lastAtRaw?: string | null;
    lastMessageFromMe?: boolean | null;
    lastMessageStatus?: string | null;
    lastMessageType?: string | null;
    lastMessageId?: string | null;
    unreadCount: number;
    sessionId?: string | null;
    arrivedAt?: string | null;
    firstResponseAt?: string | null;
    completedAt?: string | null;
    classificationResult?: string | null;
    classificationLabel?: string | null;
    latestCompletedAt?: string | null;
    latestCompletedClassificationResult?: string | null;
    latestCompletedClassificationLabel?: string | null;
};

type ApiConversationLabel = {
    id: string;
    title: string;
    color?: string | null;
};

type ApiConversation = {
    id: string;
    phone: string;
    displayName: string | null;
    contactDisplayPhone?: string | null;
    contactDescription?: string | null;
    photoUrl: string | null;
    status: "NEW" | "IN_PROGRESS";
    assignedTeamId: string | null;
    assignedTeamName: string | null;
    assignedUserId: string | null;
    assignedUserName: string | null;
    humanHandoffQueue?: string | null;
    startedAt: string | null;
    presenceStatus: string | null;
    presenceLastSeen: string | null;
    lastMessage: string | null;
    lastAt: string | null;
    lastMessageFromMe?: boolean | null;
    lastMessageStatus?: string | null;
    lastMessageType?: string | null;
    lastMessageId?: string | null;
    unreadCount?: number | null;
    sessionId?: string | null;
    arrivedAt?: string | null;
    firstResponseAt?: string | null;
    completedAt?: string | null;
    classificationResult?: string | null;
    classificationLabel?: string | null;
    latestCompletedAt?: string | null;
    latestCompletedClassificationResult?: string | null;
    latestCompletedClassificationLabel?: string | null;
    labels?: ApiConversationLabel[] | null;
};

type ApiMessage = {
    id: string;
    text: string | null;
    type?: string | null;
    imageUrl?: string | null;
    stickerUrl?: string | null;
    videoUrl?: string | null;
    audioUrl?: string | null;
    documentUrl?: string | null;
    documentName?: string | null;
    fromMe: boolean;
    status?: string | null;
    createdAt: string;
};

type SendTextResult = {
    conversationId?: string;
};

type AtendimentoUser = {
    id: string;
    fullName: string;
    email: string;
    teamId?: string | null;
    teamName?: string | null;
};

type AtendimentoTeam = {
    id: string;
    name: string;
};

type MeResponse = {
    userId: string;
    fullName?: string | null;
    profileImageUrl?: string | null;
    teamId?: string | null;
    teamName?: string | null;
    roles?: string[] | null;
};

type DdiOption = {
    iso: CountryCode;
    ddi: string;
    country: string;
    flagUrl: string;
};

type MediaViewerState = {
    type: "image" | "video";
    source: string;
    sender: string;
    senderPhotoUrl?: string | null;
    senderAvatarText: string;
    at: string;
};

const BRUSH_COLORS = ["#111827", "#6b7280", "#ffffff", "#06b6d4", "#22c55e", "#a855f7", "#6b00e3", "#ef4444"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 16 * 1024 * 1024;
const AUDIO_WAVE_BARS = 36;
const AUDIO_WAVE_UPDATE_INTERVAL_MS = 90;
const CONTACT_SIDEBAR_ANIMATION_MS = 220;
const ATENDIMENTOS_AUTO_REFRESH_INTERVAL_MS = 15000;
type ImageTextLayer = {
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
    fontSize: number;
    boxWidth: number;
    rotation: number;
};

type TimelineNoticeKind = "start" | "transfer";
type TimelineNotice = {
    id: string;
    text: string;
    atRaw: string;
    kind: TimelineNoticeKind;
};
type ContactSidebarTab = "details" | "media";
type ContactSidebarDraft = {
    name: string;
    phone: string;
    description: string;
    labelIds: string[];
};
type ContactMediaItem = {
    id: string;
    type: "image" | "sticker" | "video" | "audio" | "document";
    source: string;
    at: string;
    atRaw: string;
    text: string;
    message: Message;
};

type ResolvedMessageMediaType = ContactMediaItem["type"];
type DroppedMediaKind = "image" | "video" | "document";
type DroppedMediaCandidate =
    | { kind: "file"; file: File; mediaKind: DroppedMediaKind }
    | { kind: "url"; url: string }
    | { kind: "error"; message: string };
type DroppedMediaResolution =
    | { kind: "file"; file: File; mediaKind: DroppedMediaKind }
    | { kind: "error"; message: string };

const URL_PATTERN = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi;
const IMAGE_FILE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i;
const DROP_URI_TRANSFER_TYPES = ["text/uri-list", "text/x-moz-url", "URL", "public.url"];

function normalizePhone(value: string) {
    return value.replace(/\D/g, "");
}

function normalizeDisplayPhone(value: string | null | undefined) {
    return String(value ?? "").trim();
}

function normalizeClassificationResult(value: string | null | undefined) {
    const normalized = String(value ?? "").trim().toUpperCase().replace(/[-\s]+/g, "_");
    if (normalized === "OBJECTIVE_ACHIEVED") return "OBJECTIVE_ACHIEVED";
    if (normalized === "OBJECTIVE_LOST") return "OBJECTIVE_LOST";
    if (normalized === "QUESTION") return "QUESTION";
    if (normalized === "OTHER") return "OTHER";
    return null;
}

function classificationCategoryFromResult(result: string | null | undefined): "achieved" | "lost" | "questions" | "other" | null {
    const normalized = normalizeClassificationResult(result);
    if (normalized === "OBJECTIVE_ACHIEVED") return "achieved";
    if (normalized === "OBJECTIVE_LOST") return "lost";
    if (normalized === "QUESTION") return "questions";
    if (normalized === "OTHER") return "other";
    return null;
}

function toDayKey(value: string | null | undefined) {
    const time = toTimestamp(value);
    const date = new Date(time || Date.now());
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function relativeDayLabel(value: string | null | undefined) {
    const time = toTimestamp(value);
    const target = new Date(time || Date.now());
    const now = new Date();
    const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.max(0, Math.floor((nowStart - targetStart) / (24 * 60 * 60 * 1000)));
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `Há ${diffDays} dias`;
    if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `Há ${weeks} semana${weeks > 1 ? "s" : ""}`;
    }
    if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `Há ${months} m${months > 1 ? "eses" : "ês"}`;
    }
    const years = Math.floor(diffDays / 365);
    return `Há ${years} ano${years > 1 ? "s" : ""}`;
}

function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateDataUrlBytes(dataUrl: string) {
    const base64 = dataUrl.split(",")[1] ?? "";
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function getDocumentExtension(fileName: string) {
    const normalized = fileName.trim();
    const extension = normalized.includes(".") ? normalized.split(".").pop() ?? "" : "";
    const sanitized = extension.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return sanitized || null;
}

function formatTime(value: string | null | undefined) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value: string | null | undefined) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDurationSeconds(totalSeconds: number) {
    if (!Number.isFinite(totalSeconds)) return "00:00";
    const safe = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function toTimestamp(value?: string | null) {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
}

function formatCurrencyBRLInput(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    const amount = Number(digits) / 100;
    return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseCurrencyBRLInput(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) return null;
    return Number(digits) / 100;
}

function getPresenceLabel(status?: string | null) {
    const normalized = (status ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (normalized === "COMPOSING" || normalized === "TYPING" || normalized === "DIGITANDO" || normalized === "IS_COMPOSING") {
        return "Digitando...";
    }
    if (normalized === "RECORDING" || normalized === "RECORDING_AUDIO" || normalized === "GRAVANDO" || normalized === "IS_RECORDING") {
        return "Gravando áudio...";
    }
    if (normalized === "AVAILABLE" || normalized === "ONLINE" || normalized === "CONNECTED" || normalized === "PAUSED" || normalized === "IDLE") {
        return "Online agora";
    }
    return "";
}

function isComposingPresence(status?: string | null) {
    const normalized = (status ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    return normalized === "COMPOSING" || normalized === "TYPING" || normalized === "DIGITANDO" || normalized === "IS_COMPOSING";
}

function isAvailablePresence(status?: string | null) {
    const normalized = (status ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    return normalized === "AVAILABLE" || normalized === "ONLINE" || normalized === "CONNECTED" || normalized === "PAUSED" || normalized === "IDLE";
}

function toAvatar(value: string) {
    const normalized = normalizePhone(value);
    if (normalized.length >= 2) return normalized.slice(-2);
    return normalized.padStart(2, "0");
}

function toInitials(value: string) {
    const parts = value
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return "??";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatBrazilianLocalNumber(value: string) {
    const digits = normalizePhone(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatContactPhone(value: string | null | undefined) {
    const raw = normalizeDisplayPhone(value);
    if (!raw) return "-";
    const digits = normalizePhone(raw);
    if (!digits) return raw;
    if (raw.startsWith("+") || raw.includes("(") || raw.includes(")") || raw.includes("-") || raw.includes(" ")) {
        return raw;
    }
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        return `+55 ${formatBrazilianLocalNumber(digits.slice(2))}`;
    }
    if (digits.length === 10 || digits.length === 11) {
        return formatBrazilianLocalNumber(digits);
    }
    return raw;
}

function splitMessageGraphemes(value: string) {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
        const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
        return Array.from(segmenter.segment(value), (part) => part.segment);
    }
    return Array.from(value);
}

function isEmojiGrapheme(value: string) {
    return /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/u.test(value);
}

function isEmojiOnlyMessage(value: string) {
    const compact = value.replace(/\s+/g, "");
    if (!compact) return false;
    const graphemes = splitMessageGraphemes(compact);
    return graphemes.length > 0 && graphemes.every((grapheme) => isEmojiGrapheme(grapheme));
}

function countEmojiGraphemes(value: string) {
    return splitMessageGraphemes(value.replace(/\s+/g, "")).filter((grapheme) => isEmojiGrapheme(grapheme)).length;
}

function hasEmojiGrapheme(value: string) {
    return splitMessageGraphemes(value).some((grapheme) => isEmojiGrapheme(grapheme));
}

function getMessageTextClass(value: string) {
    const baseClass = "whitespace-pre-wrap break-words [overflow-wrap:anywhere]";
    if (isEmojiOnlyMessage(value)) {
        const emojiCount = countEmojiGraphemes(value);
        if (emojiCount === 1) {
            return `${baseClass} text-[3.6rem] leading-[0.95] md:text-[3.5rem]`;
        }
        if (emojiCount === 2) {
            return `${baseClass} text-[3rem] leading-[1] tracking-[0.08em] md:text-[3rem]`;
        }
        if (emojiCount === 3) {
            return `${baseClass} text-[2.5rem] leading-[1.02] tracking-[0.06em] md:text-[3.05rem]`;
        }
        if (emojiCount <= 6) {
            return `${baseClass} text-[1.8rem] leading-[1.12] tracking-[0.03em] md:text-[2.2rem]`;
        }
        return `${baseClass} text-[1.45rem] leading-[1.2] md:text-[1.7rem]`;
    }
    if (hasEmojiGrapheme(value)) {
        return `${baseClass} text-[15px] leading-7 md:text-base`;
    }
    return baseClass;
}

function getResolvedMessageMediaType(message: Pick<Message, "type" | "imageUrl" | "stickerUrl" | "videoUrl" | "audioUrl" | "documentUrl">): ResolvedMessageMediaType | null {
    const normalizedType = normalizeMessageType(message.type);
    if (normalizedType === "image" && message.imageUrl) return "image";
    if (normalizedType === "sticker" && message.stickerUrl) return "sticker";
    if (normalizedType === "video" && message.videoUrl) return "video";
    if ((normalizedType === "audio" || normalizedType === "ptt") && message.audioUrl) return "audio";
    if (normalizedType === "document" && message.documentUrl) return "document";
    if (message.imageUrl) return "image";
    if (message.stickerUrl) return "sticker";
    if (message.videoUrl) return "video";
    if (message.audioUrl) return "audio";
    if (message.documentUrl) return "document";
    return null;
}

function isImageFile(file: Pick<File, "name" | "type">) {
    return file.type.startsWith("image/") || IMAGE_FILE_EXTENSION_PATTERN.test(file.name);
}

function isVideoFile(file: Pick<File, "name" | "type">) {
    return file.type.startsWith("video/");
}

function getDroppedFileMediaKind(file: Pick<File, "name" | "type">): DroppedMediaKind {
    if (isImageFile(file)) return "image";
    if (isVideoFile(file)) return "video";
    return "document";
}

function getImageExtensionFromContentType(contentType: string | null | undefined) {
    const normalized = String(contentType ?? "").trim().toLowerCase();
    if (!normalized.startsWith("image/")) return "";
    if (normalized === "image/jpeg") return ".jpg";
    if (normalized === "image/svg+xml") return ".svg";
    if (normalized === "image/x-icon") return ".ico";
    return `.${normalized.slice("image/".length).split(";")[0]}`;
}

function sanitizeFileName(value: string) {
    const trimmed = value.trim().replace(/["']/g, "");
    const sanitized = trimmed.replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-").replace(/\s+/g, "-");
    return sanitized.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function inferDroppedImageFileName(source: string, contentType?: string | null) {
    const fallbackExtension = getImageExtensionFromContentType(contentType) || ".png";

    if (source.startsWith("data:")) {
        return `imagem-arrastada${fallbackExtension}`;
    }

    if (source.startsWith("blob:")) {
        return `imagem-do-navegador${fallbackExtension}`;
    }

    try {
        const url = new URL(source);
        const rawName = decodeURIComponent(url.pathname.split("/").pop() ?? "");
        const sanitized = sanitizeFileName(rawName);
        if (sanitized && IMAGE_FILE_EXTENSION_PATTERN.test(sanitized)) {
            return sanitized;
        }
        if (sanitized) {
            return `${sanitized}${fallbackExtension}`;
        }
    } catch {
        // Fall back to a generic name when the URL cannot be parsed.
    }

    return `imagem-arrastada${fallbackExtension}`;
}

function extractFirstUriFromTransferText(value: string) {
    const lines = value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    for (const line of lines) {
        if (line.startsWith("#")) continue;
        return line;
    }
    return null;
}

function normalizeDroppedImageUrl(value: string) {
    const normalized = value.trim().replace(/^['"]|['"]$/g, "");
    if (!normalized) return null;
    if (
        normalized.startsWith("data:") ||
        normalized.startsWith("blob:") ||
        normalized.startsWith("http://") ||
        normalized.startsWith("https://")
    ) {
        return normalized;
    }
    return null;
}

function extractImageSourceFromHtml(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (typeof DOMParser !== "undefined") {
        const doc = new DOMParser().parseFromString(trimmed, "text/html");
        const src = doc.querySelector("img[src]")?.getAttribute("src") ?? "";
        const normalized = normalizeDroppedImageUrl(src);
        if (normalized) return normalized;
    }

    const match = trimmed.match(/<img[^>]+src=["']([^"']+)["']/i);
    return normalizeDroppedImageUrl(match?.[1] ?? "");
}

function parseContentDispositionFileName(value: string | null) {
    if (!value) return null;
    const starMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (starMatch?.[1]) {
        return sanitizeFileName(decodeURIComponent(starMatch[1]));
    }
    const match = value.match(/filename="?([^";]+)"?/i);
    if (!match?.[1]) return null;
    return sanitizeFileName(match[1]);
}

function shouldIgnoreNoiseMessage(
    message: Pick<Message, "type" | "text" | "imageUrl" | "stickerUrl" | "videoUrl" | "audioUrl" | "documentUrl">
) {
    return normalizeMessageType(message.type) === "unknown" && !message.text.trim() && !getResolvedMessageMediaType(message);
}

function countOccurrences(value: string, fragment: string) {
    return value.split(fragment).length - 1;
}

function splitTrailingUrlPunctuation(value: string) {
    let url = value;
    let trailing = "";
    while (url) {
        const lastChar = url.slice(-1);
        if (/[.,!?;:]/.test(lastChar)) {
            trailing = `${lastChar}${trailing}`;
            url = url.slice(0, -1);
            continue;
        }
        if (lastChar === ")" && countOccurrences(url, "(") < countOccurrences(url, ")")) {
            trailing = `${lastChar}${trailing}`;
            url = url.slice(0, -1);
            continue;
        }
        if (lastChar === "]" && countOccurrences(url, "[") < countOccurrences(url, "]")) {
            trailing = `${lastChar}${trailing}`;
            url = url.slice(0, -1);
            continue;
        }
        break;
    }
    return { url, trailing };
}

function normalizeLinkHref(value: string) {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function renderLinkedText(text: string, linkClassName: string) {
    URL_PATTERN.lastIndex = 0;
    const matches = Array.from(text.matchAll(URL_PATTERN));
    if (!matches.length) return text;

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    for (const match of matches) {
        const matchedValue = match[0];
        const matchIndex = match.index ?? 0;
        if (matchIndex > cursor) {
            nodes.push(text.slice(cursor, matchIndex));
        }

        const { url, trailing } = splitTrailingUrlPunctuation(matchedValue);
        if (url) {
            nodes.push(
                <a
                    key={`message-link-${matchIndex}-${url}`}
                    href={normalizeLinkHref(url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClassName}
                >
                    {url}
                </a>
            );
        } else {
            nodes.push(matchedValue);
        }

        if (trailing) {
            nodes.push(trailing);
        }
        cursor = matchIndex + matchedValue.length;
    }

    if (cursor < text.length) {
        nodes.push(text.slice(cursor));
    }
    return nodes;
}

function MessageText({
    text,
    className,
    linkClassName,
}: {
    text: string;
    className: string;
    linkClassName: string;
}) {
    return <p className={className}>{renderLinkedText(text, linkClassName)}</p>;
}

type OutgoingMessageStatus = "sent" | "received" | "read";

function toOutgoingMessageStatus(status?: string | null): OutgoingMessageStatus {
    const normalized = (status ?? "").toUpperCase();
    if (normalized === "READ" || normalized === "READ_BY_ME" || normalized === "PLAYED") return "read";
    if (normalized === "RECEIVED") return "received";
    return "sent";
}

function MessageStatusCheck({ status, tone = "bubble" }: { status: OutgoingMessageStatus; tone?: "bubble" | "list" }) {
    const colorClass =
        tone === "bubble"
            ? (status === "read" ? "text-white" : "text-white/70")
            : (status === "read" ? "text-violet-600" : "text-black/45");
    if (status === "sent") {
        return <Check className={`h-3.5 w-3.5 ${colorClass}`} strokeWidth={1.8} aria-hidden="true" />;
    }
    return <CheckCheck className={`h-3.5 w-3.5 ${colorClass}`} strokeWidth={1.7} aria-hidden="true" />;
}

const INVALID_MESSAGE_NOTICE = "Formato de mensagem não suportado.";

function normalizeMessageType(type?: string | null) {
    return (type ?? "text").trim().toLowerCase();
}

function isSupportedMessageType(type?: string | null) {
    const normalized = normalizeMessageType(type);
    return normalized === "text" || normalized === "image" || normalized === "video" || normalized === "document" || normalized === "audio" || normalized === "ptt";
}

function getInvalidMessageNotice(type?: string | null, text?: string | null) {
    if ((text ?? "").trim()) return null;
    const normalized = normalizeMessageType(type);
    if (normalized === "unknown") return null;
    if (!normalized || normalized === "text" || isSupportedMessageType(normalized)) return null;
    return INVALID_MESSAGE_NOTICE;
}

function getInvalidMessageTypeDetail(type?: string | null) {
    const normalized = normalizeMessageType(type).replace(/[_-]+/g, " ").trim();
    if (!normalized || normalized === "unknown") return "desconhecido";
    return normalized;
}

function getMessageTypeLabel(type?: string | null, text?: string | null) {
    if ((text ?? "").trim()) return null;
    const normalized = normalizeMessageType(type);
    if (normalized === "unknown") return null;
    if (normalized === "image") return "Foto";
    if (normalized === "sticker") return "Figurinha";
    if (normalized === "video") return "Vídeo";
    if (normalized === "document") return "Documento";
    if (normalized === "audio" || normalized === "ptt") return "Áudio";
    if (normalized && normalized !== "text") return "Mensagem inválida";
    return null;
}

function MessageTypeListIcon({ type }: { type?: string | null }) {
    const normalized = (type ?? "").toLowerCase();
    if (normalized === "image") {
        return <ImageIcon className="h-3.5 w-3.5 text-black/55" strokeWidth={1.8} />;
    }
    if (normalized === "sticker") {
        return <Smile className="h-3.5 w-3.5 text-black/55" strokeWidth={1.8} />;
    }
    if (normalized === "video") {
        return <Video className="h-3.5 w-3.5 text-black/55" strokeWidth={1.8} />;
    }
    if (normalized === "document") {
        return <FileText className="h-3.5 w-3.5 text-black/55" strokeWidth={1.8} />;
    }
    if (normalized === "audio" || normalized === "ptt") {
        return <Mic className="h-3.5 w-3.5 text-black/55" strokeWidth={1.8} />;
    }
    return null;
}

function buildAudioWaveBars(seed: string, count = 42) {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return Array.from({ length: count }, (_, index) => {
        const x = Math.sin((hash + index * 17) * 0.017) * 0.5 + 0.5;
        return 0.25 + x * 0.75;
    });
}

function AudioMessageInline({
    src,
    fromMe,
    timeLabel,
    status,
    contactPhotoUrl,
    contactInitials,
}: {
    src: string;
    fromMe: boolean;
    timeLabel: string;
    status?: string | null;
    contactPhotoUrl?: string | null;
    contactInitials?: string;
}) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const waveBars = useMemo(() => buildAudioWaveBars(src, 34), [src]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const sync = () => {
            const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
            setDuration(nextDuration);
            setCurrentTime(audio.currentTime || 0);
            setIsPlaying(!audio.paused && !audio.ended);
        };

        const onLoadedMetadata = () => sync();
        const onTimeUpdate = () => sync();
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("ended", onEnded);
        sync();

        return () => {
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("ended", onEnded);
        };
    }, [src]);

    function togglePlay() {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) {
            void audio.play();
            return;
        }
        audio.pause();
    }

    function seekAudio(event: React.MouseEvent<HTMLButtonElement>) {
        const audio = audioRef.current;
        if (!audio || !duration) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        audio.currentTime = ratio * duration;
        setCurrentTime(audio.currentTime);
    }

    const toneSoft = fromMe ? "text-white/80" : "text-black/55";
    const waveActive = fromMe ? "bg-white" : "bg-io-purple/90";
    const waveInactive = fromMe ? "bg-white/35" : "bg-black/20";
    const playTone = fromMe ? "text-white" : "text-io-purple";
    const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
    const progressBars = Math.round(progress * waveBars.length);
    const elapsed = formatDurationSeconds(currentTime);
    const total = formatDurationSeconds(duration);
    const durationLabel = duration > 0 ? total : elapsed;

    return (
        <div className="w-[320px] max-w-full">
            <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
            <div className="flex items-center gap-3">
                {contactPhotoUrl ? (
                    <img src={contactPhotoUrl} alt="Contato" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${fromMe ? "bg-white/20 text-white" : "bg-io-purple/15 text-io-purple"}`}>
                        {(contactInitials ?? "CT").slice(0, 2).toUpperCase()}
                    </div>
                )}
                <button
                    type="button"
                    onClick={togglePlay}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${playTone}`}
                    aria-label={isPlaying ? "Pausar áudio" : "Tocar áudio"}
                >
                    {isPlaying ? <Pause className="h-4 w-4" strokeWidth={2} /> : <Play className="h-4 w-4" strokeWidth={2} />}
                </button>
                <div className="min-w-0 flex-1">
                    <button type="button" onClick={seekAudio} className="block w-full text-left" aria-label="Barra de progresso do áudio">
                        <div className="flex h-6 items-center gap-[2px]">
                            {waveBars.map((value, index) => (
                                <span
                                    key={`audio-wave-${index}`}
                                    className={`w-[3px] rounded-full ${index <= progressBars ? waveActive : waveInactive}`}
                                    style={{ height: `${Math.max(3, Math.round(11 * value))}px` }}
                                />
                            ))}
                        </div>
                    </button>
                    <div className={`mt-0.5 flex items-center justify-between text-[10px] ${toneSoft}`}>
                        <span>{durationLabel}</span>
                        <div className="flex items-center gap-1 min-w-0">
                            <span>{timeLabel}</span>
                            {fromMe ? <MessageStatusCheck status={toOutgoingMessageStatus(status)} /> : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LabelBadge({ label }: { label: ContactLabel }) {
    return (
        <span
            className="inline-flex items-center rounded-full px-2 py-[3px] text-[11px] font-semibold"
            style={{ backgroundColor: label.color, color: getLabelTextColor(label.color) }}
            title={label.title}
        >
            {label.title}
        </span>
    );
}

type FilterSelectOption = {
    value: string;
    label: string;
    chipStyle?: CSSProperties;
};

type LegacyContactOverride = {
    name?: string;
    phone?: string;
    description?: string;
    lastAt?: string;
};

const LEGACY_CONTACT_OVERRIDES_KEY = "io.crm.lead.defaultValues";
const LEGACY_TIMELINE_NOTICES_KEY = "io.atendimento.timelineNotices";
const LEGACY_READ_TOKENS_KEY = "io.atendimento.readTokens";
const LEGACY_REOPEN_HANDLED_KEY = "io.atendimento.reopenHandled";

function readLegacyStorageRecord<T>(key: string) {
    if (typeof window === "undefined") return {} as Record<string, T>;
    try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed as Record<string, T>
            : {};
    } catch {
        return {};
    }
}

function clearLegacyAtendimentoStorage() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(LEGACY_CONTACT_OVERRIDES_KEY);
    window.localStorage.removeItem(LEGACY_TIMELINE_NOTICES_KEY);
    window.localStorage.removeItem(LEGACY_READ_TOKENS_KEY);
    window.localStorage.removeItem(LEGACY_REOPEN_HANDLED_KEY);
    clearLegacyContactLabelAssignments();
}

function buildLegacyConversationToken(chat: Chat) {
    return `${chat.lastAtRaw ?? ""}|${chat.lastMessage}|${chat.lastMessageFromMe ? "1" : "0"}|${chat.lastMessageStatus ?? ""}|${chat.lastMessageType ?? ""}`;
}

type CompactMultiSelectProps = {
    title: string;
    placeholder: string;
    selectedValues: string[];
    options: FilterSelectOption[];
    emptyOptionsMessage: string;
    emptySelectionMessage: string;
    onChange: (nextValues: string[]) => void;
};

function toggleFilterValue(values: string[], value: string) {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function CompactMultiSelect({
    title,
    placeholder,
    selectedValues,
    options,
    emptyOptionsMessage,
    emptySelectionMessage,
    onChange,
}: CompactMultiSelectProps) {
    const optionsByValue = new Map(options.map((option) => [option.value, option]));
    const selectedOptions = selectedValues
        .map((value) => optionsByValue.get(value))
        .filter((option): option is FilterSelectOption => Boolean(option));
    const placeholderLabel = selectedOptions.length === 0
        ? placeholder
        : `${selectedOptions.length} selecionado${selectedOptions.length > 1 ? "s" : ""}`;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-black/45">{title}</p>
                {selectedOptions.length > 0 ? (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                        {selectedOptions.length}
                    </span>
                ) : null}
            </div>
            {options.length === 0 ? (
                <p className="rounded-lg border border-dashed border-black/10 px-3 py-2 text-xs text-black/50">{emptyOptionsMessage}</p>
            ) : (
                <>
                    <div className="relative">
                        <select
                            value=""
                            onChange={(event) => {
                                const nextValue = event.target.value;
                                if (!nextValue) return;
                                onChange(toggleFilterValue(selectedValues, nextValue));
                                event.target.value = "";
                            }}
                            className="h-10 w-full appearance-none rounded-lg border border-black/10 bg-white px-3 pr-9 text-sm text-io-dark outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                        >
                            <option value="">{placeholderLabel}</option>
                            {options.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {selectedValues.includes(option.value) ? "[x] " : ""}
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" strokeWidth={2} />
                    </div>
                    <div className="min-h-11 rounded-lg border border-dashed border-black/10 bg-black/[0.02] px-2.5 py-2">
                        {selectedOptions.length === 0 ? (
                            <p className="text-xs text-black/50">{emptySelectionMessage}</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {selectedOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => onChange(selectedValues.filter((value) => value !== option.value))}
                                        className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${option.chipStyle ? "border border-transparent" : "border border-black/10 bg-white text-io-dark"}`}
                                        style={option.chipStyle}
                                        title={`Remover filtro ${option.label}`}
                                    >
                                        <span className="truncate">{option.label}</span>
                                        <X className="h-3 w-3 shrink-0" strokeWidth={2} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export function AtendimentosWorkspace() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const routeConversationId = useMemo(() => {
        const match = pathname?.match(/^\/protected\/atendimentos\/([^/]+)$/);
        return match?.[1] ? decodeURIComponent(match[1]) : "";
    }, [pathname]);
    const routeTab = useMemo(() => {
        const raw = (searchParams?.get("tab") ?? "").trim().toLowerCase();
        if (raw === "new" || raw === "mine" || raw === "all" || raw === "auto") return raw;
        return "";
    }, [searchParams]);

    const [chats, setChats] = useState<Chat[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [draftsByChatId, setDraftsByChatId] = useState<Record<string, string>>({});
    const [pendingPhone, setPendingPhone] = useState("");
    const [countryIso, setCountryIso] = useState<CountryCode>("BR");
    const [newChatNumber, setNewChatNumber] = useState("");
    const [ddiQuery, setDdiQuery] = useState("");
    const [isDdiOpen, setIsDdiOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"new" | "mine" | "all">("new");
    const [showConcludedOnly, setShowConcludedOnly] = useState(false);
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const [selectedAssignedUserIds, setSelectedAssignedUserIds] = useState<string[]>([]);
    const [selectedTeamNames, setSelectedTeamNames] = useState<string[]>([]);
    const [selectedFilterLabelIds, setSelectedFilterLabelIds] = useState<string[]>([]);
    const [sortOrder, setSortOrder] = useState<"recent_first" | "oldest_first">("recent_first");
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const [mobileView, setMobileView] = useState<"list" | "chat">("list");
    const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [imagePreviewCaption, setImagePreviewCaption] = useState("");
    const [imagePreviewSource, setImagePreviewSource] = useState("");
    const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);
    const [videoPreviewSource, setVideoPreviewSource] = useState("");
    const [videoPreviewCaption, setVideoPreviewCaption] = useState("");
    const [videoPreviewMuted, setVideoPreviewMuted] = useState(false);
    const [isVideoPreviewPlaying, setIsVideoPreviewPlaying] = useState(false);
    const [videoPreviewCurrentTime, setVideoPreviewCurrentTime] = useState(0);
    const [videoPreviewDuration, setVideoPreviewDuration] = useState(0);
    const [videoEditorMode, setVideoEditorMode] = useState<"draw" | "text">("draw");
    const [videoTextLayers, setVideoTextLayers] = useState<ImageTextLayer[]>([]);
    const [selectedVideoTextLayerId, setSelectedVideoTextLayerId] = useState<string | null>(null);
    const [videoEditorHistory, setVideoEditorHistory] = useState<Array<{ overlayData: string | null; textLayers: ImageTextLayer[] }>>([]);
    const [imageEditorMode, setImageEditorMode] = useState<"draw" | "text" | "crop">("draw");
    const [imageDrawColor, setImageDrawColor] = useState("#ffffff");
    const [imageDrawSize, setImageDrawSize] = useState(4);
    const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [imageTextLayers, setImageTextLayers] = useState<ImageTextLayer[]>([]);
    const [selectedTextLayerId, setSelectedTextLayerId] = useState<string | null>(null);
    const [editorHistory, setEditorHistory] = useState<Array<{ imageData: string; textLayers: ImageTextLayer[] }>>([]);
    const [unreadByChatId, setUnreadByChatId] = useState<Record<string, number>>({});
    const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
    const [mediaViewer, setMediaViewer] = useState<MediaViewerState | null>(null);
    const [isDownloadingMedia, setIsDownloadingMedia] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [isSendingText, setIsSendingText] = useState(false);
    const [isSendingMedia, setIsSendingMedia] = useState(false);
    const [isMessageDropActive, setIsMessageDropActive] = useState(false);
    const [isResolvingDroppedMedia, setIsResolvingDroppedMedia] = useState(false);
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
    const [audioRecordSeconds, setAudioRecordSeconds] = useState(0);
    const [isRecordedAudioPlaying, setIsRecordedAudioPlaying] = useState(false);
    const [recordedAudioCurrentTime, setRecordedAudioCurrentTime] = useState(0);
    const [recordedAudioDuration, setRecordedAudioDuration] = useState(0);
    const [audioWaveform, setAudioWaveform] = useState<number[]>(() => Array.from({ length: AUDIO_WAVE_BARS }, () => 0.08));
    const [currentUserId, setCurrentUserId] = useState<string>("");
    const [currentUserPhotoUrl, setCurrentUserPhotoUrl] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState<string>("");
    const [currentTeamId, setCurrentTeamId] = useState<string>("");
    const [currentTeamName, setCurrentTeamName] = useState<string>("");
    const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([]);
    const [transferTeams, setTransferTeams] = useState<AtendimentoTeam[]>([]);
    const [transferUsers, setTransferUsers] = useState<AtendimentoUser[]>([]);
    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [transferMode, setTransferMode] = useState<"manual" | "conversation">("conversation");
    const [selectedTransferTeamId, setSelectedTransferTeamId] = useState("");
    const [selectedTransferUserId, setSelectedTransferUserId] = useState("");
    const [manualTargetPhone, setManualTargetPhone] = useState("");
    const [isStarting, setIsStarting] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [availableLabels, setAvailableLabels] = useState<ContactLabel[]>([]);
    const [areCatalogsLoaded, setAreCatalogsLoaded] = useState(false);
    const [areConversationsLoaded, setAreConversationsLoaded] = useState(false);
    const [labelsByContact, setLabelsByContact] = useState<ContactLabelAssignments>({});
    const [isChatLabelsOpen, setIsChatLabelsOpen] = useState(false);
    const [availableClassifications, setAvailableClassifications] = useState<AtendimentoClassification[]>([]);
    const [contactConclusions, setContactConclusions] = useState<ContactConclusionMap>({});
    const [timelineNotices, setTimelineNotices] = useState<TimelineNotice[]>([]);
    const [isConcludeModalOpen, setIsConcludeModalOpen] = useState(false);
    const [concludeClassificationId, setConcludeClassificationId] = useState("");
    const [concludeLabelIds, setConcludeLabelIds] = useState<string[]>([]);
    const [concludeModalMsg, setConcludeModalMsg] = useState<string | null>(null);
    const [concludeCategoryId, setConcludeCategoryId] = useState<"achieved" | "lost" | "questions" | "other">("achieved");
    const [concludeSearchTerm, setConcludeSearchTerm] = useState("");
    const [isManageClassificationsPopupOpen, setIsManageClassificationsPopupOpen] = useState(false);
    const [isManageLabelsPopupOpen, setIsManageLabelsPopupOpen] = useState(false);
    const [isManageClassificationFormOpen, setIsManageClassificationFormOpen] = useState(false);
    const [manageClassificationEditingId, setManageClassificationEditingId] = useState<string | null>(null);
    const [manageClassificationTitle, setManageClassificationTitle] = useState("");
    const [manageClassificationCategoryId, setManageClassificationCategoryId] = useState<"achieved" | "lost" | "questions" | "other">("other");
    const [manageClassificationHasValue, setManageClassificationHasValue] = useState(false);
    const [manageClassificationValue, setManageClassificationValue] = useState("");
    const [manageClassificationMsg, setManageClassificationMsg] = useState<string | null>(null);
    const [showSelectedChatHistory, setShowSelectedChatHistory] = useState(false);
    const [isContactSidebarOpen, setIsContactSidebarOpen] = useState(false);
    const [isContactSidebarVisible, setIsContactSidebarVisible] = useState(false);
    const [isContactSidebarActive, setIsContactSidebarActive] = useState(false);
    const [contactSidebarTab, setContactSidebarTab] = useState<ContactSidebarTab>("details");
    const [isContactSidebarEditing, setIsContactSidebarEditing] = useState(false);
    const [isDeleteConversationModalOpen, setIsDeleteConversationModalOpen] = useState(false);
    const [isDeletingContactConversation, setIsDeletingContactConversation] = useState(false);
    const [deleteConversationModalMsg, setDeleteConversationModalMsg] = useState<string | null>(null);
    const [contactSidebarDraft, setContactSidebarDraft] = useState<ContactSidebarDraft>({
        name: "",
        phone: "",
        description: "",
        labelIds: [],
    });
    const [contactSidebarMsg, setContactSidebarMsg] = useState<string | null>(null);
    const ddiDropdownRef = useRef<HTMLDivElement | null>(null);
    const chatLabelsDropdownRef = useRef<HTMLDivElement | null>(null);
    const advancedFiltersRef = useRef<HTMLDivElement | null>(null);
    const sortMenuRef = useRef<HTMLDivElement | null>(null);
    const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
    const emojiPickerRef = useRef<HTMLDivElement | null>(null);
    const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
    const galleryInputRef = useRef<HTMLInputElement | null>(null);
    const videoInputRef = useRef<HTMLInputElement | null>(null);
    const documentInputRef = useRef<HTMLInputElement | null>(null);
    const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    const previousSelectedIdRef = useRef<string>("");
    const selectedIdRef = useRef<string>("");
    const liveWorkspaceRefreshInFlightRef = useRef(false);
    const liveWorkspaceRefreshQueuedRef = useRef(false);
    const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
    const videoOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const videoOverlayStageRef = useRef<HTMLDivElement | null>(null);
    const videoIsDrawingRef = useRef(false);
    const videoLastDrawPointRef = useRef<{ x: number; y: number } | null>(null);
    const videoTextDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
    const imageEditorCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const imageEditorBaseImageRef = useRef<HTMLImageElement | null>(null);
    const imageEditorStageRef = useRef<HTMLDivElement | null>(null);
    const isDrawingRef = useRef(false);
    const lastDrawPointRef = useRef<{ x: number; y: number } | null>(null);
    const cropStartRef = useRef<{ x: number; y: number } | null>(null);
    const cropBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
    const textDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
    const textResizeRef = useRef<{ id: string; startX: number; startY: number; startWidth: number; startFontSize: number } | null>(null);
    const routeSelectionAppliedRef = useRef<string>("");
    const legacyStorageMigrationAttemptedRef = useRef(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioAnalyserRef = useRef<AnalyserNode | null>(null);
    const audioAnimationFrameRef = useRef<number | null>(null);
    const audioTimerRef = useRef<number | null>(null);
    const audioRecordingStartRef = useRef<number>(0);
    const messageDropDepthRef = useRef(0);
    const contactSidebarCloseTimeoutRef = useRef<number | null>(null);
    const contactSidebarEnterFrameRef = useRef<number | null>(null);
    const contactSidebarEnterFrameNestedRef = useRef<number | null>(null);

    const concludedContactKeys = useMemo(() => new Set(Object.keys(contactConclusions)), [contactConclusions]);
    const visibleChats = useMemo(
        () => chats.filter((chat) => {
            const key = normalizePhone(chat.phone);
            const conclusion = contactConclusions[key];
            if (!conclusion) return true;
            const lastAt = toTimestamp(chat.lastAtRaw);
            const concludedAt = toTimestamp(conclusion.concludedAt);
            return lastAt > concludedAt;
        }),
        [chats, contactConclusions, concludedContactKeys]
    );
    const concludedChats = useMemo(
        () => chats.filter((chat) => {
            const key = normalizePhone(chat.phone);
            const conclusion = contactConclusions[key];
            if (!conclusion) return false;
            const lastAt = toTimestamp(chat.lastAtRaw);
            const concludedAt = toTimestamp(conclusion.concludedAt);
            return lastAt <= concludedAt;
        }),
        [chats, contactConclusions]
    );
    const selectedChat = useMemo(() => chats.find((chat) => chat.id === selectedId) ?? null, [chats, selectedId]);
    const selectedChatDraft = useMemo(() => (selectedId ? (draftsByChatId[selectedId] ?? "") : ""), [draftsByChatId, selectedId]);
    const selectedChatDraftTrimmed = useMemo(() => selectedChatDraft.trim(), [selectedChatDraft]);
    const transferUsersForSelectedTeam = useMemo(
        () => (selectedTransferTeamId ? transferUsers.filter((user) => user.teamId === selectedTransferTeamId) : []),
        [transferUsers, selectedTransferTeamId]
    );
    const isSelectedChatConcluded = useMemo(() => {
        if (!selectedChat) return false;
        const contactKey = normalizePhone(selectedChat.phone);
        const conclusion = contactConclusions[contactKey];
        if (!conclusion) return false;
        const lastAt = toTimestamp(selectedChat.lastAtRaw);
        const concludedAt = toTimestamp(conclusion.concludedAt);
        return lastAt <= concludedAt;
    }, [selectedChat, contactConclusions]);
    const selectedChatIsUnassigned = useMemo(() => (selectedChat ? isChatUnassigned(selectedChat) : false), [selectedChat]);
    const selectedChatIsInCurrentTeam = useMemo(
        () => (selectedChat ? isChatInCurrentTeam(selectedChat) : false),
        [selectedChat, currentTeamId]
    );
    const selectedChatIsTeamQueue = useMemo(
        () => (selectedChat ? isChatInTeamQueue(selectedChat) : false),
        [selectedChat, currentTeamId]
    );
    const selectedChatIsAssignedToTeammate = useMemo(
        () => Boolean(selectedChat && selectedChatIsInCurrentTeam && selectedChat.assignedUserId && selectedChat.assignedUserId !== currentUserId),
        [selectedChat, selectedChatIsInCurrentTeam, currentUserId]
    );
    const selectedChatContactKey = useMemo(() => (selectedChat ? normalizePhone(selectedChat.phone) : ""), [selectedChat]);
    const selectedChatLabelIds = useMemo(() => labelsByContact[selectedChatContactKey] ?? [], [labelsByContact, selectedChatContactKey]);
    const selectedChatLabels = useMemo(
        () => availableLabels.filter((label) => selectedChatLabelIds.includes(label.id)),
        [availableLabels, selectedChatLabelIds]
    );
    const selectedChatDescription = useMemo(
        () => selectedChat?.description?.trim() || "",
        [selectedChat]
    );
    const isCurrentUserSuperAdmin = useMemo(
        () => currentUserRoles.some((role) => role.toUpperCase() === "SUPERADMIN"),
        [currentUserRoles]
    );
    const selectedChatMediaItems = useMemo<ContactMediaItem[]>(() => {
        return [...messages]
            .filter((message) => Boolean(getResolvedMessageMediaType(message)))
            .sort((a, b) => toTimestamp(a.atRaw) - toTimestamp(b.atRaw))
            .map((message) => {
                const mediaType = getResolvedMessageMediaType(message);
                if (mediaType === "image" && message.imageUrl) {
                    return {
                        id: message.id,
                        type: "image",
                        source: message.imageUrl,
                        at: message.at,
                        atRaw: message.atRaw ?? "",
                        text: message.text,
                        message,
                    };
                }
                if (mediaType === "sticker" && message.stickerUrl) {
                    return {
                        id: message.id,
                        type: "sticker",
                        source: message.stickerUrl,
                        at: message.at,
                        atRaw: message.atRaw ?? "",
                        text: message.text,
                        message,
                    };
                }
                if (mediaType === "video" && message.videoUrl) {
                    return {
                        id: message.id,
                        type: "video",
                        source: message.videoUrl,
                        at: message.at,
                        atRaw: message.atRaw ?? "",
                        text: message.text,
                        message,
                    };
                }
                if (mediaType === "document" && message.documentUrl) {
                    return {
                        id: message.id,
                        type: "document",
                        source: message.documentUrl,
                        at: message.at,
                        atRaw: message.atRaw ?? "",
                        text: message.text,
                        message,
                    };
                }
                return {
                    id: message.id,
                    type: "audio",
                    source: message.audioUrl ?? "",
                    at: message.at,
                    atRaw: message.atRaw ?? "",
                    text: message.text,
                    message,
                };
            });
    }, [messages]);
    const labelsByContactKey = useMemo(() => {
        const map: Record<string, ContactLabel[]> = {};
        for (const chat of chats) {
            const key = normalizePhone(chat.phone);
            const ids = labelsByContact[key] ?? [];
            map[key] = availableLabels.filter((label) => ids.includes(label.id));
        }
        return map;
    }, [availableLabels, chats, labelsByContact]);
    function isChatUnassigned(chat: Chat) {
        return !chat.assignedTeamId && !chat.assignedUserId;
    }

    function isChatInCurrentTeam(chat: Chat) {
        return Boolean(currentTeamId) && chat.assignedTeamId === currentTeamId;
    }

    function isChatMine(chat: Chat) {
        return Boolean(currentUserId) && chat.assignedUserId === currentUserId;
    }

    function isChatInTeamQueue(chat: Chat) {
        return isChatInCurrentTeam(chat) && !chat.assignedUserId;
    }

    function markChatAsRead(chat: Chat | null | undefined) {
        if (!chat || !isChatMine(chat)) return;
        setUnreadByChatId((previous) => ({ ...previous, [chat.id]: 0 }));
        void fetch(`/api/atendimentos/conversations/${chat.id}/read`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lastMessageId: chat.lastMessageId ?? null }),
        });
    }

    function isChatInNewTab(chat: Chat) {
        return isChatUnassigned(chat);
    }

    const newChatsCount = useMemo(
        () => visibleChats.filter((chat) => isChatInNewTab(chat)).length,
        [visibleChats]
    );
    const newUnreadCount = useMemo(
        () =>
            visibleChats
                .filter((chat) => isChatInNewTab(chat))
                .reduce((acc, chat) => acc + (unreadByChatId[chat.id] ?? 0), 0),
        [visibleChats, unreadByChatId]
    );
    const mineUnreadCount = useMemo(
        () =>
            visibleChats
                .filter((chat) => isChatMine(chat))
                .reduce((acc, chat) => acc + (unreadByChatId[chat.id] ?? 0), 0),
        [visibleChats, unreadByChatId, currentUserId]
    );
    const allUnreadCount = useMemo(
        () => visibleChats.reduce((acc, chat) => acc + (unreadByChatId[chat.id] ?? 0), 0),
        [visibleChats, unreadByChatId]
    );
    const ddiOptions = useMemo<DdiOption[]>(() => {
        const displayNames = new Intl.DisplayNames(["pt-BR"], { type: "region" });
        return getCountries()
            .map((iso) => {
                const ddi = `+${getCountryCallingCode(iso)}`;
                const country = displayNames.of(iso) ?? iso;
                const flagUrl = `https://flagcdn.com/24x18/${iso.toLowerCase()}.png`;
                return { iso, ddi, country, flagUrl };
            })
            .sort((a, b) => a.country.localeCompare(b.country, "pt-BR"));
    }, []);
    const selectedDdi = useMemo(() => ddiOptions.find((option) => option.iso === countryIso) ?? null, [ddiOptions, countryIso]);
    const filteredDdiOptions = useMemo(() => {
        const q = ddiQuery.trim().toLowerCase();
        if (!q) return ddiOptions;
        return ddiOptions.filter((option) => option.country.toLowerCase().includes(q) || option.ddi.includes(q) || option.iso.toLowerCase().includes(q));
    }, [ddiOptions, ddiQuery]);
    const displayedLocalNumber = useMemo(() => {
        if (countryIso !== "BR") return newChatNumber;
        return formatBrazilianLocalNumber(newChatNumber);
    }, [countryIso, newChatNumber]);
    const filteredChats = useMemo(() => {
        const base = showConcludedOnly ? concludedChats : visibleChats;
        const term = searchTerm.trim().toLowerCase();
        let next = !term
            ? base
            : base.filter((chat) =>
                chat.name.toLowerCase().includes(term) ||
                chat.phone.includes(term) ||
                normalizeDisplayPhone(chat.displayPhone).toLowerCase().includes(term) ||
                chat.lastMessage.toLowerCase().includes(term)
            );

        if (!showConcludedOnly) {
            next = next.filter((chat) => {
                if (activeTab === "all") return true;
                if (activeTab === "new") return isChatInNewTab(chat);
                return isChatMine(chat);
            });
        }

        if (selectedAssignedUserIds.length > 0) {
            next = next.filter((chat) => {
                const userId = chat.assignedUserId ?? "__unassigned__";
                return selectedAssignedUserIds.includes(userId);
            });
        }

        if (selectedTeamNames.length > 0) {
            next = next.filter((chat) => {
                const teamName = chat.teamName?.trim() || "__no_team__";
                return selectedTeamNames.includes(teamName);
            });
        }

        if (selectedFilterLabelIds.length > 0) {
            next = next.filter((chat) => {
                const chatLabelIds = labelsByContact[normalizePhone(chat.phone)] ?? [];
                return selectedFilterLabelIds.some((id) => chatLabelIds.includes(id));
            });
        }

        if (showUnreadOnly) {
            next = next.filter((chat) => (unreadByChatId[chat.id] ?? 0) > 0);
        }

        return [...next].sort((a, b) => {
            const aAt = toTimestamp(a.lastAtRaw);
            const bAt = toTimestamp(b.lastAtRaw);
            return sortOrder === "recent_first" ? bAt - aAt : aAt - bAt;
        });
    }, [
        showConcludedOnly,
        concludedChats,
        visibleChats,
        searchTerm,
        activeTab,
        currentUserId,
        selectedAssignedUserIds,
        selectedTeamNames,
        selectedFilterLabelIds,
        labelsByContact,
        showUnreadOnly,
        unreadByChatId,
        sortOrder,
    ]);
    const userFilterOptions = useMemo(() => {
        const map = new Map<string, string>();
        for (const user of transferUsers) {
            map.set(user.id, user.fullName);
        }
        for (const chat of chats) {
            if (chat.assignedUserId && chat.assignedUserName) {
                map.set(chat.assignedUserId, map.get(chat.assignedUserId) ?? chat.assignedUserName);
            }
        }
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }, [chats, transferUsers]);
    const teamFilterOptions = useMemo(() => {
        const teams = Array.from(new Set(
            chats
                .map((chat) => chat.teamName?.trim() || "")
                .filter(Boolean)
        ));
        return teams.sort((a, b) => a.localeCompare(b, "pt-BR"));
    }, [chats]);
    const userFilterSelectOptions = useMemo<FilterSelectOption[]>(
        () => [
            { value: "__unassigned__", label: "Sem atendente" },
            ...userFilterOptions.map((user) => ({ value: user.id, label: user.name })),
        ],
        [userFilterOptions]
    );
    const teamFilterSelectOptions = useMemo<FilterSelectOption[]>(
        () => [
            { value: "__no_team__", label: "Sem equipe" },
            ...teamFilterOptions.map((teamName) => ({ value: teamName, label: teamName })),
        ],
        [teamFilterOptions]
    );
    const labelFilterSelectOptions = useMemo<FilterSelectOption[]>(
        () =>
            [...availableLabels]
                .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
                .map((label) => ({
                    value: label.id,
                    label: label.title,
                    chipStyle: { backgroundColor: label.color, color: getLabelTextColor(label.color) },
                })),
        [availableLabels]
    );
    const displayedMessages = useMemo(
        () => [...messages, ...pendingMessages.filter((message) => message.chatId === selectedId)],
        [messages, pendingMessages, selectedId]
    );
    const selectedChatConclusion = useMemo(
        () => (selectedChatContactKey ? contactConclusions[selectedChatContactKey] ?? null : null),
        [contactConclusions, selectedChatContactKey]
    );
    const hasOlderHistoryInSelectedChat = useMemo(() => {
        if (!selectedChatConclusion) return false;
        const concludedAt = toTimestamp(selectedChatConclusion.concludedAt);
        return displayedMessages.some((message) => toTimestamp(message.atRaw) <= concludedAt);
    }, [displayedMessages, selectedChatConclusion]);
    const visibleMessages = useMemo(() => {
        if (!selectedChatConclusion || showSelectedChatHistory) return displayedMessages;
        const concludedAt = toTimestamp(selectedChatConclusion.concludedAt);
        return displayedMessages.filter((message) => toTimestamp(message.atRaw) > concludedAt || !message.atRaw);
    }, [displayedMessages, selectedChatConclusion, showSelectedChatHistory]);
    const selectedChatTimelineNotices = useMemo(() => {
        if (!selectedChat) return [] as TimelineNotice[];
        const hasPersistedStart = timelineNotices.some((notice) => notice.kind === "start");
        const fallbackStartNotice = selectedChat.startedAt && !hasPersistedStart
            ? [{
                id: `start-fallback-${selectedChat.id}-${selectedChat.startedAt}`,
                text: `Atendimento iniciado em ${formatDateTime(selectedChat.startedAt)}`,
                atRaw: selectedChat.startedAt,
                kind: "start" as const,
            }]
            : [];
        const combined = [...fallbackStartNotice, ...timelineNotices];
        const unique = new Map<string, TimelineNotice>();
        for (const notice of combined) {
            const key = `${notice.kind}|${notice.atRaw}|${notice.text}`;
            if (!unique.has(key)) unique.set(key, notice);
        }
        const all = Array.from(unique.values()).sort((a, b) => toTimestamp(a.atRaw) - toTimestamp(b.atRaw));
        if (!selectedChatConclusion || showSelectedChatHistory) return all;
        const concludedAt = toTimestamp(selectedChatConclusion.concludedAt);
        return all.filter((notice) => toTimestamp(notice.atRaw) > concludedAt);
    }, [selectedChat, timelineNotices, selectedChatConclusion, showSelectedChatHistory]);
    const timelineEntries = useMemo(() => {
        const sortable = [
            ...selectedChatTimelineNotices.map((notice, index) => ({
                entryKind: "notice" as const,
                id: notice.id,
                atRaw: notice.atRaw,
                sortAt: toTimestamp(notice.atRaw) || index,
                notice,
                index,
            })),
            ...visibleMessages.map((message, index) => ({
                entryKind: "message" as const,
                id: `msg-${message.id}`,
                atRaw: message.atRaw ?? new Date().toISOString(),
                sortAt: toTimestamp(message.atRaw) || (10_000_000_000_000 + index),
                message,
                index,
            })),
        ]
            .sort((a, b) => {
                if (a.sortAt !== b.sortAt) return a.sortAt - b.sortAt;
                if (a.entryKind !== b.entryKind) return a.entryKind === "notice" ? -1 : 1;
                return a.index - b.index;
            });
        const result: Array<
            | { kind: "date"; id: string; label: string }
            | { kind: "notice"; id: string; notice: TimelineNotice }
            | { kind: "message"; id: string; message: Message }
        > = [];
        let previousDayKey = "";
        for (const item of sortable) {
            const dayKey = toDayKey(item.atRaw);
            if (dayKey !== previousDayKey) {
                previousDayKey = dayKey;
                result.push({ kind: "date", id: `date-${dayKey}`, label: relativeDayLabel(item.atRaw) });
            }
            if (item.entryKind === "notice") result.push({ kind: "notice", id: item.id, notice: item.notice });
            else result.push({ kind: "message", id: item.id, message: item.message });
        }
        return result;
    }, [selectedChatTimelineNotices, visibleMessages]);
    const classificationCategories = useMemo(() => listAtendimentoClassificationCategories(), []);
    const concludeVisibleClassifications = useMemo(() => {
        const term = concludeSearchTerm.trim().toLowerCase();
        return availableClassifications.filter((item) => {
            if (item.categoryId !== concludeCategoryId) return false;
            if (!term) return true;
            return item.title.toLowerCase().includes(term);
        });
    }, [availableClassifications, concludeCategoryId, concludeSearchTerm]);
    const lastDisplayedMessageToken = useMemo(() => {
        const last = timelineEntries[timelineEntries.length - 1];
        if (!last) return "";
        if (last.kind === "message") {
            const message = last.message;
            return `message|${message.id}|${message.chatId}|${message.at}|${message.status ?? ""}|${message.pending ? "1" : "0"}`;
        }
        if (last.kind === "notice") return `notice|${last.notice.id}|${last.notice.atRaw}|${last.notice.text}`;
        return `date|${last.id}|${last.label}`;
    }, [timelineEntries]);

    async function loadLabelsState() {
        setAvailableLabels(await loadContactLabels());
    }

    async function loadConclusionState() {
        const custom = await loadCustomAtendimentoClassifications();
        setAvailableClassifications(listAllAtendimentoClassifications(custom));
    }

    function buildLabelsPayload(labelIds: string[]) {
        const normalizedIds = Array.from(new Set(labelIds.map((id) => id.trim()).filter(Boolean)));
        return normalizedIds
            .map((id) => availableLabels.find((label) => label.id === id))
            .filter((label): label is ContactLabel => Boolean(label))
            .map((label) => ({
                id: label.id,
                title: label.title,
                color: label.color,
            }));
    }

    async function syncConversationLabels(conversationId: string, labelIds: string[]) {
        const res = await fetch(`/api/atendimentos/conversations/${conversationId}/labels`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                labels: buildLabelsPayload(labelIds),
            }),
        });
        if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { message?: string } | null;
            throw new Error(data?.message ?? "Falha ao salvar etiquetas");
        }
    }

    async function loadTimelineNotices(conversationId: string) {
        if (!conversationId) {
            setTimelineNotices([]);
            return;
        }
        const response = await fetch(`/api/atendimentos/conversations/${conversationId}/events`, { cache: "no-store" });
        if (!response.ok) {
            setTimelineNotices([]);
            return;
        }
        const data = (await response.json().catch(() => [])) as Array<{
            id?: string;
            type?: string;
            text?: string;
            at?: string;
        }>;
        setTimelineNotices(
            (Array.isArray(data) ? data : [])
                .map((event) => {
                    const id = String(event.id ?? "").trim();
                    const text = String(event.text ?? "").trim();
                    const atRaw = String(event.at ?? "").trim();
                    const kind = event.type === "transfer" ? "transfer" : event.type === "start" ? "start" : null;
                    if (!id || !text || !atRaw || !kind) return null;
                    return { id, text, atRaw, kind } satisfies TimelineNotice;
                })
                .filter((event): event is TimelineNotice => Boolean(event))
        );
    }

    async function toggleLabelOnSelectedChat(labelId: string) {
        if (!selectedChat) return;
        const contactKey = normalizePhone(selectedChat.phone);
        const current = labelsByContact[contactKey] ?? [];
        const nextIds = current.includes(labelId)
            ? current.filter((id) => id !== labelId)
            : [...current, labelId];
        try {
            await syncConversationLabels(selectedChat.id, nextIds);
            setLabelsByContact((previous) => {
                const next = { ...previous };
                if (nextIds.length) next[contactKey] = Array.from(new Set(nextIds));
                else delete next[contactKey];
                return next;
            });
        } catch (error) {
            setSendError(error instanceof Error ? error.message : "Falha ao salvar etiquetas");
        }
    }

    function openContactSidebar() {
        if (!selectedChat) return;
        setIsContactSidebarOpen(true);
        setContactSidebarMsg(null);
    }

    function closeContactSidebar() {
        setIsContactSidebarOpen(false);
        setIsContactSidebarEditing(false);
        setContactSidebarMsg(null);
    }

    function openDeleteConversationModal() {
        if (!selectedChat || isDeletingContactConversation) return;
        setDeleteConversationModalMsg(null);
        setIsDeleteConversationModalOpen(true);
    }

    function closeDeleteConversationModal() {
        if (isDeletingContactConversation) return;
        setIsDeleteConversationModalOpen(false);
        setDeleteConversationModalMsg(null);
    }

    function cleanupDeletedContactState(chat: Chat) {
        const contactKey = normalizePhone(chat.phone);
        const chatIdsToRemove = new Set(
            chats
                .filter((item) => item.id === chat.id || normalizePhone(item.phone) === contactKey)
                .map((item) => item.id)
        );
        setChats((previous) => previous.filter((item) => !chatIdsToRemove.has(item.id)));
        setMessages([]);
        setPendingMessages((previous) => previous.filter((message) => !message.chatId || !chatIdsToRemove.has(message.chatId)));
        setUnreadByChatId((previous) => {
            const next = { ...previous };
            for (const chatId of chatIdsToRemove) delete next[chatId];
            return next;
        });
        setLabelsByContact((previous) => {
            const next = { ...previous };
            delete next[contactKey];
            return next;
        });
        setContactConclusions((previous) => {
            const next = { ...previous };
            delete next[contactKey];
            return next;
        });
        setTimelineNotices([]);
        routeSelectionAppliedRef.current = "";
        closeContactSidebar();
        setSelectedId((current) => (chatIdsToRemove.has(current) ? "" : current));
        setMobileView("list");
    }

    function startContactSidebarEditing() {
        if (!selectedChat) return;
        setContactSidebarDraft({
            name: selectedChat.name,
            phone: normalizeDisplayPhone(selectedChat.displayPhone) || selectedChat.phone,
            description: selectedChatDescription,
            labelIds: selectedChatLabelIds,
        });
        setIsContactSidebarEditing(true);
        setContactSidebarMsg(null);
    }

    function cancelContactSidebarEditing() {
        if (!selectedChat) {
            setIsContactSidebarEditing(false);
            setContactSidebarMsg(null);
            return;
        }
        setContactSidebarDraft({
            name: selectedChat.name,
            phone: normalizeDisplayPhone(selectedChat.displayPhone) || selectedChat.phone,
            description: selectedChatDescription,
            labelIds: selectedChatLabelIds,
        });
        setIsContactSidebarEditing(false);
        setContactSidebarMsg(null);
    }

    async function deleteSelectedConversation() {
        if (!selectedChat || isDeletingContactConversation) return;
        const chatToDelete = selectedChat;
        setIsDeletingContactConversation(true);
        setContactSidebarMsg(null);
        setDeleteConversationModalMsg(null);
        try {
            const res = await fetch(`/api/atendimentos/conversations/${chatToDelete.id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { message?: string } | null;
                throw new Error(data?.message ?? "Falha ao excluir conversa");
            }

            setIsDeleteConversationModalOpen(false);
            cleanupDeletedContactState(chatToDelete);
            await loadConversations();
        } catch (error) {
            setDeleteConversationModalMsg(error instanceof Error ? error.message : "Falha ao excluir conversa");
        } finally {
            setIsDeletingContactConversation(false);
        }
    }

    function toggleContactSidebarDraftLabel(labelId: string) {
        setContactSidebarDraft((previous) => ({
            ...previous,
            labelIds: previous.labelIds.includes(labelId)
                ? previous.labelIds.filter((id) => id !== labelId)
                : [...previous.labelIds, labelId],
        }));
    }

    async function saveContactSidebarChanges() {
        if (!selectedChat) return;
        const nextName = contactSidebarDraft.name.trim() || selectedChat.name;
        const nextDisplayPhone = normalizeDisplayPhone(contactSidebarDraft.phone) || selectedChat.phone;
        const nextDescription = contactSidebarDraft.description.trim();
        const contactKey = normalizePhone(selectedChat.phone);
        const nextLabelIds = Array.from(new Set(contactSidebarDraft.labelIds));
        try {
            const contactResponse = await fetch(`/api/atendimentos/conversations/${selectedChat.id}/contact`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    displayName: nextName,
                    displayPhone: nextDisplayPhone,
                    description: nextDescription,
                }),
            });
            if (!contactResponse.ok) {
                const data = (await contactResponse.json().catch(() => null)) as { message?: string } | null;
                throw new Error(data?.message ?? "Falha ao salvar os dados do contato.");
            }
            await syncConversationLabels(selectedChat.id, nextLabelIds);
            setChats((previous) => previous.map((chat) => (
                chat.id === selectedChat.id
                    ? {
                        ...chat,
                        name: nextName,
                        displayPhone: nextDisplayPhone,
                        description: nextDescription,
                        avatar: chat.photoUrl ? chat.avatar : toInitials(nextName),
                    }
                    : chat
            )));
            setLabelsByContact((previous) => {
                const next = { ...previous };
                if (nextLabelIds.length) next[contactKey] = nextLabelIds;
                else delete next[contactKey];
                return next;
            });
        } catch (error) {
            setContactSidebarMsg(error instanceof Error ? error.message : "Falha ao salvar etiquetas.");
            return;
        }

        setContactSidebarDraft({
            name: nextName,
            phone: nextDisplayPhone,
            description: nextDescription,
            labelIds: nextLabelIds,
        });
        setIsContactSidebarEditing(false);
        setContactSidebarMsg("Dados do contato atualizados.");
    }

    function toggleConcludeClassification(classificationId: string) {
        setConcludeClassificationId((previous) => (previous === classificationId ? "" : classificationId));
    }

    function toggleConcludeLabel(labelId: string) {
        setConcludeLabelIds((previous) => (
            previous.includes(labelId)
                ? previous.filter((id) => id !== labelId)
                : [...previous, labelId]
        ));
    }

    function openConcludeModal() {
        if (!selectedChat) return;
        const contactKey = normalizePhone(selectedChat.phone);
        const fallbackCategory = classificationCategoryFromResult(selectedChat.latestCompletedClassificationResult);
        const fallbackClassificationId = fallbackCategory
            ? availableClassifications.find((item) => {
                if (item.categoryId !== fallbackCategory) return false;
                if (selectedChat.latestCompletedClassificationLabel?.trim()) {
                    return item.title.trim().toLowerCase() === selectedChat.latestCompletedClassificationLabel.trim().toLowerCase();
                }
                return item.system;
            })?.id ?? ""
            : contactConclusions[contactKey]?.classificationIds?.[0] ?? "";
        setConcludeClassificationId(fallbackClassificationId);
        setConcludeLabelIds(labelsByContact[contactKey] ?? []);
        setConcludeCategoryId(fallbackCategory ?? "achieved");
        setConcludeSearchTerm("");
        setConcludeModalMsg(null);
        setIsConcludeModalOpen(true);
    }

    function closeConcludeModal() {
        setIsConcludeModalOpen(false);
        setConcludeModalMsg(null);
        setIsManageClassificationsPopupOpen(false);
        setIsManageLabelsPopupOpen(false);
    }

    async function concludeSelectedChat() {
        if (!selectedChat) return;
        if (!concludeClassificationId) {
            setConcludeModalMsg("Selecione ao menos uma classificação.");
            return;
        }

        const classification = availableClassifications.find((item) => item.id === concludeClassificationId);
        const classificationCategory = classification?.categoryId;
        const classificationResult =
            classificationCategory === "achieved"
                ? "OBJECTIVE_ACHIEVED"
                : classificationCategory === "lost"
                    ? "OBJECTIVE_LOST"
                    : classificationCategory === "questions"
                        ? "QUESTION"
                        : classificationCategory === "other"
                            ? "OTHER"
                            : null;
        if (!classification || !classificationResult) {
            setConcludeModalMsg("Não foi possível identificar a classificação selecionada.");
            return;
        }

        const normalizedLabelIds = Array.from(new Set(concludeLabelIds));
        const labelsPayload = buildLabelsPayload(normalizedLabelIds);
        try {
            const res = await fetch(`/api/atendimentos/conversations/${selectedChat.id}/conclude`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    classificationResult,
                    classificationLabel: classification.title,
                    labels: labelsPayload,
                }),
            });
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { message?: string } | null;
                setConcludeModalMsg(data?.message ?? "Falha ao concluir atendimento.");
                return;
            }

            await loadConversations();
            setSelectedId("");
            setMobileView("list");
            closeConcludeModal();
        } catch (error) {
            setConcludeModalMsg(error instanceof Error ? error.message : "Falha ao concluir atendimento.");
        }
    }

    function resetManageClassificationForm() {
        setIsManageClassificationFormOpen(false);
        setManageClassificationEditingId(null);
        setManageClassificationTitle("");
        setManageClassificationCategoryId("other");
        setManageClassificationHasValue(false);
        setManageClassificationValue("");
        setManageClassificationMsg(null);
    }

    function openManageClassificationEditor(item?: AtendimentoClassification) {
        setIsManageClassificationFormOpen(true);
        if (!item) {
            setManageClassificationEditingId(null);
            setManageClassificationTitle("");
            setManageClassificationCategoryId("other");
            setManageClassificationHasValue(false);
            setManageClassificationValue("");
            setManageClassificationMsg(null);
            return;
        }
        setManageClassificationEditingId(item.id);
        setManageClassificationTitle(item.title);
        setManageClassificationCategoryId(item.categoryId);
        setManageClassificationHasValue(Boolean(item.hasValue));
        setManageClassificationValue(item.hasValue && item.value != null ? formatCurrencyBRLInput(String(Math.round(item.value * 100))) : "");
        setManageClassificationMsg(null);
    }

    async function saveManageClassificationInModal() {
        setManageClassificationMsg(null);
        const title = manageClassificationTitle.trim();
        if (!title) {
            setManageClassificationMsg("Informe o título da classificação.");
            return;
        }
        const parsedValue = parseCurrencyBRLInput(manageClassificationValue);
        if (manageClassificationHasValue && parsedValue == null) {
            setManageClassificationMsg("Informe um valor numérico válido.");
            return;
        }
        const currentCustom = availableClassifications.filter((item) => !item.system);
        const duplicate = currentCustom.some((item) =>
            item.id !== manageClassificationEditingId &&
            item.title.trim().toLowerCase() === title.toLowerCase() &&
            item.categoryId === manageClassificationCategoryId
        );
        if (duplicate) {
            setManageClassificationMsg("Já existe uma classificação com esse título nessa categoria.");
            return;
        }
        const now = new Date().toISOString();
        const next = manageClassificationEditingId
            ? currentCustom.map((item) => (
                item.id === manageClassificationEditingId
                    ? {
                        ...item,
                        title,
                        categoryId: manageClassificationCategoryId,
                        hasValue: manageClassificationHasValue,
                        value: manageClassificationHasValue ? parsedValue : null,
                        updatedAt: now,
                    }
                    : item
            ))
            : [
                ...currentCustom,
                {
                    id: `classification_${Date.now()}`,
                    title,
                    categoryId: manageClassificationCategoryId,
                    hasValue: manageClassificationHasValue,
                    value: manageClassificationHasValue ? parsedValue : null,
                    system: false,
                    createdAt: now,
                    updatedAt: now,
                },
            ];
        try {
            const saved = await saveCustomAtendimentoClassifications(next);
            setAvailableClassifications(listAllAtendimentoClassifications(saved));
            resetManageClassificationForm();
        } catch (error) {
            setManageClassificationMsg(error instanceof Error ? error.message : "Não foi possível salvar a classificação.");
        }
    }

    async function removeCustomClassificationInModal(item: AtendimentoClassification) {
        const next = availableClassifications.filter((current) => !current.system && current.id !== item.id);
        try {
            const saved = await saveCustomAtendimentoClassifications(next);
            setAvailableClassifications(listAllAtendimentoClassifications(saved));
            if (concludeClassificationId === item.id) setConcludeClassificationId("");
            if (manageClassificationEditingId === item.id) resetManageClassificationForm();
        } catch (error) {
            setManageClassificationMsg(error instanceof Error ? error.message : "Não foi possível excluir a classificação.");
        }
    }

    async function toggleCustomClassificationValueFlag(item: AtendimentoClassification) {
        if (item.system) return;
        const next = availableClassifications.filter((current) => !current.system).map((current) => {
            if (current.id !== item.id) return current;
            const enabled = !current.hasValue;
            return {
                ...current,
                hasValue: enabled,
                value: enabled ? (current.value ?? 0) : null,
                updatedAt: new Date().toISOString(),
            };
        });
        try {
            const saved = await saveCustomAtendimentoClassifications(next);
            setAvailableClassifications(listAllAtendimentoClassifications(saved));
        } catch (error) {
            setManageClassificationMsg(error instanceof Error ? error.message : "Não foi possível atualizar a classificação.");
        }
    }

    function scrollMessagesToBottom(behavior: ScrollBehavior = "auto") {
        const container = messagesContainerRef.current;
        if (!container) return;
        container.scrollTo({ top: container.scrollHeight, behavior });
    }

    async function loadConversations() {
        const res = await fetch("/api/atendimentos/conversations", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json().catch(() => [])) as ApiConversation[];
        const classificationsCatalog = availableClassifications.length > 0 ? availableClassifications : listAllAtendimentoClassifications();
        const nextConclusions: ContactConclusionMap = {};
        const nextLabelsByContact: ContactLabelAssignments = {};
        const mapped = data.map((chat) => {
            const normalizedPhone = normalizePhone(chat.phone);
            const fallbackName = chat.displayName?.trim() || normalizedPhone;
            const normalizedLabels = Array.isArray(chat.labels)
                ? chat.labels.map((label) => String(label.id ?? "").trim()).filter(Boolean)
                : [];
            if (normalizedLabels.length > 0) {
                nextLabelsByContact[normalizedPhone] = Array.from(new Set(normalizedLabels));
            }

            const historyCutoffAt = chat.latestCompletedAt ?? null;
            if (historyCutoffAt) {
                const classificationCategory = classificationCategoryFromResult(chat.latestCompletedClassificationResult);
                const fallbackClassificationId = classificationCategory
                    ? classificationsCatalog.find((item) => {
                        if (item.categoryId !== classificationCategory) return false;
                        if (chat.latestCompletedClassificationLabel?.trim()) {
                            return item.title.trim().toLowerCase() === chat.latestCompletedClassificationLabel.trim().toLowerCase();
                        }
                        return item.system;
                    })?.id ?? ""
                    : "";
                nextConclusions[normalizedPhone] = {
                    classificationIds: fallbackClassificationId ? [fallbackClassificationId] : [],
                    concludedAt: historyCutoffAt,
                };
            }
            return {
                id: chat.id,
                phone: normalizedPhone,
                displayPhone: normalizeDisplayPhone(chat.contactDisplayPhone) || normalizedPhone,
                name: fallbackName,
                description: chat.contactDescription?.trim() || "",
                avatar: toInitials(fallbackName),
                photoUrl: chat.photoUrl,
                status: chat.status,
                assignedTeamId: chat.assignedTeamId,
                assignedTeamName: chat.assignedTeamName,
                assignedUserId: chat.assignedUserId,
                assignedUserName: chat.assignedUserName,
                teamName: chat.assignedTeamName?.trim() || chat.humanHandoffQueue?.trim() || null,
                startedAt: chat.startedAt,
                presenceStatus: chat.presenceStatus,
                presenceLastSeen: chat.presenceLastSeen,
                lastMessage: chat.lastMessage?.trim() || "",
                lastAt: formatTime(chat.lastAt),
                lastAtRaw: chat.lastAt,
                lastMessageFromMe: chat.lastMessageFromMe ?? null,
                lastMessageStatus: chat.lastMessageStatus ?? null,
                lastMessageType: chat.lastMessageType ?? null,
                lastMessageId: chat.lastMessageId ?? null,
                unreadCount: Math.max(0, Number(chat.unreadCount ?? 0) || 0),
                sessionId: chat.sessionId ?? null,
                arrivedAt: chat.arrivedAt ?? null,
                firstResponseAt: chat.firstResponseAt ?? null,
                completedAt: chat.completedAt ?? null,
                classificationResult: chat.classificationResult ?? null,
                classificationLabel: chat.classificationLabel ?? null,
                latestCompletedAt: chat.latestCompletedAt ?? null,
                latestCompletedClassificationResult: chat.latestCompletedClassificationResult ?? null,
                latestCompletedClassificationLabel: chat.latestCompletedClassificationLabel ?? null,
            } satisfies Chat;
        });
        setChats(mapped);
        setAreConversationsLoaded(true);
        setContactConclusions(nextConclusions);
        setLabelsByContact(nextLabelsByContact);
        const activeConversationId = selectedIdRef.current;
        const nextUnread: Record<string, number> = {};
        for (const chat of mapped) {
            const isActiveAndMine = activeConversationId === chat.id && Boolean(currentUserId) && chat.assignedUserId === currentUserId;
            nextUnread[chat.id] = isActiveAndMine ? 0 : chat.unreadCount;
            if (isActiveAndMine && chat.unreadCount > 0) {
                void fetch(`/api/atendimentos/conversations/${chat.id}/read`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lastMessageId: chat.lastMessageId ?? null }),
                });
            }
        }
        setUnreadByChatId(nextUnread);
        setSelectedId((currentSelectedId) => {
            if (!mapped.length) return "";
            if (!currentSelectedId) return "";
            const stillExists = mapped.some((chat) => chat.id === currentSelectedId);
            return stillExists ? currentSelectedId : "";
        });
    }

    async function loadMessages(conversationId: string) {
        if (!conversationId) {
            setMessages([]);
            setTimelineNotices([]);
            return;
        }
        const [res] = await Promise.all([
            fetch(`/api/atendimentos/conversations/${conversationId}/messages`, { cache: "no-store" }),
            loadTimelineNotices(conversationId),
        ]);
        if (!res.ok) return;
        const data = (await res.json().catch(() => [])) as ApiMessage[];
        setMessages(
            data
                .map((message) => ({
                    id: message.id,
                    chatId: conversationId,
                    text: message.text ?? "",
                    type: normalizeMessageType(message.type),
                    imageUrl: message.imageUrl ?? null,
                    stickerUrl: message.stickerUrl ?? null,
                    videoUrl: message.videoUrl ?? null,
                    audioUrl: message.audioUrl ?? null,
                    documentUrl: message.documentUrl ?? null,
                    documentName: message.documentName ?? null,
                    fromMe: message.fromMe,
                    at: formatTime(message.createdAt),
                    atRaw: message.createdAt,
                    status: message.status ?? null,
                }))
                .filter((message) => !shouldIgnoreNoiseMessage(message))
        );
    }

    useEffect(() => {
        loadConversations();
    }, []);

    useEffect(() => {
        if (!routeConversationId) {
            routeSelectionAppliedRef.current = "";
            return;
        }
        if (routeSelectionAppliedRef.current === routeConversationId) return;
        const exists = chats.some((chat) => chat.id === routeConversationId);
        if (!exists) return;
        handleSelectChat(routeConversationId);
        routeSelectionAppliedRef.current = routeConversationId;
    }, [routeConversationId, chats]);

    useEffect(() => {
        if (!routeConversationId || !routeTab) return;
        const chat = chats.find((item) => item.id === routeConversationId);
        if (!chat) return;

        let nextTab: "new" | "mine" | "all";
        if (routeTab === "new" || routeTab === "mine" || routeTab === "all") {
            nextTab = routeTab;
        } else {
            if (isChatInNewTab(chat)) {
                nextTab = "new";
            } else if (isChatMine(chat)) {
                nextTab = "mine";
            } else {
                nextTab = "all";
            }
        }
        setActiveTab((current) => (current === nextTab ? current : nextTab));
    }, [routeConversationId, routeTab, chats, currentTeamId, currentUserId]);

    useEffect(() => {
        if (!selectedTransferUserId) return;
        const isSelectedUserStillAvailable = transferUsersForSelectedTeam.some((user) => user.id === selectedTransferUserId);
        if (!isSelectedUserStillAvailable) {
            setSelectedTransferUserId("");
        }
    }, [selectedTransferUserId, transferUsersForSelectedTeam]);

    useEffect(() => {
        async function loadMe() {
            const res = await fetch("/api/auth/me", { cache: "no-store" });
            if (!res.ok) return;
            const data = (await res.json().catch(() => null)) as MeResponse | null;
            if (data?.userId) setCurrentUserId(data.userId);
            setCurrentUserPhotoUrl(data?.profileImageUrl ?? null);
            setCurrentUserName(data?.fullName?.trim() ?? "");
            setCurrentTeamId(data?.teamId?.trim() ?? "");
            setCurrentTeamName(data?.teamName?.trim() ?? "");
            setCurrentUserRoles(Array.isArray(data?.roles) ? data.roles : []);
        }
        loadMe();
        loadTransferRoutingOptions();
    }, []);

    useEffect(() => {
        async function loadCatalogs() {
            try {
                await Promise.all([loadLabelsState(), loadConclusionState()]);
                setAreCatalogsLoaded(true);
            } catch (error) {
                setSendError(error instanceof Error ? error.message : "Falha ao carregar configurações do atendimento.");
            }
        }
        void loadCatalogs();
    }, []);

    useEffect(() => {
        if (!areCatalogsLoaded || !areConversationsLoaded || legacyStorageMigrationAttemptedRef.current) return;
        legacyStorageMigrationAttemptedRef.current = true;

        async function migrateLegacyStorage() {
            const legacyAssignments = readLegacyContactLabelAssignments();
            const legacyOverrides = readLegacyStorageRecord<LegacyContactOverride>(LEGACY_CONTACT_OVERRIDES_KEY);
            const legacyNotices = readLegacyStorageRecord<unknown[]>(LEGACY_TIMELINE_NOTICES_KEY);
            const legacyReadTokens = readLegacyStorageRecord<string>(LEGACY_READ_TOKENS_KEY);
            const validLabelIds = new Set(availableLabels.map((label) => label.id));

            for (const chat of chats) {
                const contactKey = normalizePhone(chat.phone);
                const legacyLabelIds = (legacyAssignments[contactKey] ?? []).filter((id) => validLabelIds.has(id));
                if (legacyLabelIds.length > 0 && (labelsByContact[contactKey] ?? []).length === 0) {
                    await syncConversationLabels(chat.id, legacyLabelIds);
                }

                const override = legacyOverrides[chat.id];
                const hasPersistedProfile = Boolean(chat.description) || normalizeDisplayPhone(chat.displayPhone) !== chat.phone;
                const sameConversationVersion = !override?.lastAt || override.lastAt === chat.lastAtRaw;
                if (override && !hasPersistedProfile && sameConversationVersion) {
                    const response = await fetch(`/api/atendimentos/conversations/${chat.id}/contact`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            displayName: override.name?.trim() || chat.name,
                            displayPhone: normalizeDisplayPhone(override.phone) || chat.phone,
                            description: override.description?.trim() || "",
                        }),
                    });
                    if (!response.ok) throw new Error("Falha ao migrar dados locais do contato.");
                }

                const rawNotices = Array.isArray(legacyNotices[contactKey]) ? legacyNotices[contactKey] : [];
                const events = rawNotices
                    .map((item) => {
                        const value = item as Partial<TimelineNotice> | null | undefined;
                        const type = value?.kind === "start" || value?.kind === "transfer" ? value.kind : null;
                        const text = String(value?.text ?? "").trim();
                        const at = String(value?.atRaw ?? "").trim();
                        if (!type || !text || !at || Number.isNaN(new Date(at).getTime())) return null;
                        return { type, text, at };
                    })
                    .filter((item): item is { type: TimelineNoticeKind; text: string; at: string } => Boolean(item));
                if (events.length > 0) {
                    const response = await fetch(`/api/atendimentos/conversations/${chat.id}/events/import`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ events }),
                    });
                    if (!response.ok) throw new Error("Falha ao migrar eventos locais do atendimento.");
                }

                const readToken = String(legacyReadTokens[chat.id] ?? "");
                if (readToken && readToken === buildLegacyConversationToken(chat)) {
                    const response = await fetch(`/api/atendimentos/conversations/${chat.id}/read`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ lastMessageId: chat.lastMessageId ?? null }),
                    });
                    if (!response.ok) throw new Error("Falha ao migrar estado de leitura da conversa.");
                }
            }

            clearLegacyAtendimentoStorage();
            await loadConversations();
            if (selectedIdRef.current) {
                await loadMessages(selectedIdRef.current);
            }
        }

        void migrateLegacyStorage().catch((error) => {
            setSendError(error instanceof Error ? error.message : "Falha ao migrar dados locais do atendimento.");
        });
    }, [areCatalogsLoaded, areConversationsLoaded, chats, availableLabels, labelsByContact]);

    useEffect(() => {
        if (!selectedChat) {
            setIsContactSidebarOpen(false);
            setIsContactSidebarActive(false);
            setIsContactSidebarVisible(false);
            setIsContactSidebarEditing(false);
            setIsDeleteConversationModalOpen(false);
            setIsDeletingContactConversation(false);
            setDeleteConversationModalMsg(null);
            setContactSidebarMsg(null);
            return;
        }
        setIsContactSidebarEditing(false);
        setIsDeleteConversationModalOpen(false);
        setIsDeletingContactConversation(false);
        setDeleteConversationModalMsg(null);
        setContactSidebarMsg(null);
        setContactSidebarTab("details");
    }, [selectedChat?.id]);

    useEffect(() => {
        if (isContactSidebarOpen) {
            if (contactSidebarEnterFrameRef.current != null) {
                window.cancelAnimationFrame(contactSidebarEnterFrameRef.current);
                contactSidebarEnterFrameRef.current = null;
            }
            if (contactSidebarEnterFrameNestedRef.current != null) {
                window.cancelAnimationFrame(contactSidebarEnterFrameNestedRef.current);
                contactSidebarEnterFrameNestedRef.current = null;
            }
            if (contactSidebarCloseTimeoutRef.current != null) {
                window.clearTimeout(contactSidebarCloseTimeoutRef.current);
                contactSidebarCloseTimeoutRef.current = null;
            }
            setIsContactSidebarVisible(true);
            setIsContactSidebarActive(false);
            contactSidebarEnterFrameRef.current = window.requestAnimationFrame(() => {
                contactSidebarEnterFrameRef.current = null;
                contactSidebarEnterFrameNestedRef.current = window.requestAnimationFrame(() => {
                    setIsContactSidebarActive(true);
                    contactSidebarEnterFrameNestedRef.current = null;
                });
            });
            return () => {
                if (contactSidebarEnterFrameRef.current != null) {
                    window.cancelAnimationFrame(contactSidebarEnterFrameRef.current);
                    contactSidebarEnterFrameRef.current = null;
                }
                if (contactSidebarEnterFrameNestedRef.current != null) {
                    window.cancelAnimationFrame(contactSidebarEnterFrameNestedRef.current);
                    contactSidebarEnterFrameNestedRef.current = null;
                }
            };
        }
        if (!isContactSidebarVisible) return;
        setIsContactSidebarActive(false);
        const timeoutId = window.setTimeout(() => {
            setIsContactSidebarVisible(false);
            contactSidebarCloseTimeoutRef.current = null;
        }, CONTACT_SIDEBAR_ANIMATION_MS);
        contactSidebarCloseTimeoutRef.current = timeoutId;
        return () => {
            if (contactSidebarEnterFrameRef.current != null) {
                window.cancelAnimationFrame(contactSidebarEnterFrameRef.current);
                contactSidebarEnterFrameRef.current = null;
            }
            if (contactSidebarEnterFrameNestedRef.current != null) {
                window.cancelAnimationFrame(contactSidebarEnterFrameNestedRef.current);
                contactSidebarEnterFrameNestedRef.current = null;
            }
            window.clearTimeout(timeoutId);
            if (contactSidebarCloseTimeoutRef.current === timeoutId) {
                contactSidebarCloseTimeoutRef.current = null;
            }
        };
    }, [isContactSidebarOpen, isContactSidebarVisible]);

    useEffect(() => {
        if (!selectedChat || isContactSidebarEditing) return;
        setContactSidebarDraft({
            name: selectedChat.name,
            phone: normalizeDisplayPhone(selectedChat.displayPhone) || selectedChat.phone,
            description: selectedChatDescription,
            labelIds: selectedChatLabelIds,
        });
    }, [
        selectedChat,
        selectedChatDescription,
        selectedChatLabelIds,
        isContactSidebarEditing,
    ]);

    useEffect(() => {
        setIsChatLabelsOpen(false);
        setShowSelectedChatHistory(showConcludedOnly);
    }, [selectedId, showConcludedOnly]);

    useEffect(() => {
        if (showConcludedOnly) return;
        if (!isSelectedChatConcluded) return;
        setSelectedId("");
        setMobileView("list");
    }, [showConcludedOnly, isSelectedChatConcluded]);

    useEffect(() => {
        if (!selectedId) {
            setMessages([]);
            return;
        }
        loadMessages(selectedId);
    }, [selectedId]);

    useEffect(() => {
        selectedIdRef.current = selectedId;
    }, [selectedId]);

    useEffect(() => {
        function handleEscapeKey(event: KeyboardEvent) {
            if (event.key !== "Escape" || event.defaultPrevented) return;
            if (!selectedId) return;

            const hasBlockingOverlay =
                isImagePreviewOpen ||
                isVideoPreviewOpen ||
                Boolean(mediaViewer) ||
                isTransferOpen ||
                isConcludeModalOpen ||
                isDeleteConversationModalOpen ||
                isManageClassificationsPopupOpen ||
                isManageLabelsPopupOpen ||
                isContactSidebarOpen ||
                isContactSidebarVisible ||
                isAttachmentMenuOpen ||
                isEmojiPickerOpen ||
                isChatLabelsOpen ||
                isAdvancedFiltersOpen ||
                isSortMenuOpen ||
                isDdiOpen ||
                isRecordingAudio ||
                Boolean(recordedAudioUrl);

            if (hasBlockingOverlay) return;

            event.preventDefault();
            closeSelectedChatView();
        }

        window.addEventListener("keydown", handleEscapeKey);
        return () => window.removeEventListener("keydown", handleEscapeKey);
    }, [
        selectedId,
        isImagePreviewOpen,
        isVideoPreviewOpen,
        mediaViewer,
        isTransferOpen,
        isConcludeModalOpen,
        isDeleteConversationModalOpen,
        isManageClassificationsPopupOpen,
        isManageLabelsPopupOpen,
        isContactSidebarOpen,
        isContactSidebarVisible,
        isAttachmentMenuOpen,
        isEmojiPickerOpen,
        isChatLabelsOpen,
        isAdvancedFiltersOpen,
        isSortMenuOpen,
        isDdiOpen,
        isRecordingAudio,
        recordedAudioUrl,
        routeConversationId,
        searchParams,
        router,
    ]);

    useEffect(() => {
        let pendingConversationReload = false;
        let pendingMessageReload = false;
        let conversationReloadTimer: number | null = null;
        let messageReloadTimer: number | null = null;

        const scheduleConversationReload = (delayMs: number) => {
            if (delayMs <= 0) {
                if (!pendingConversationReload) {
                    pendingConversationReload = true;
                    void loadConversations().finally(() => {
                        pendingConversationReload = false;
                    });
                }
                return;
            }
            if (conversationReloadTimer != null) {
                window.clearTimeout(conversationReloadTimer);
            }
            conversationReloadTimer = window.setTimeout(() => {
                conversationReloadTimer = null;
                if (!pendingConversationReload) {
                    pendingConversationReload = true;
                    void loadConversations().finally(() => {
                        pendingConversationReload = false;
                    });
                }
            }, delayMs);
        };

        const scheduleMessageReload = (conversationId: string, delayMs: number) => {
            if (delayMs <= 0) {
                if (!pendingMessageReload) {
                    pendingMessageReload = true;
                    void loadMessages(conversationId).finally(() => {
                        pendingMessageReload = false;
                    });
                }
                return;
            }
            if (messageReloadTimer != null) {
                window.clearTimeout(messageReloadTimer);
            }
            messageReloadTimer = window.setTimeout(() => {
                messageReloadTimer = null;
                if (!pendingMessageReload) {
                    pendingMessageReload = true;
                    void loadMessages(conversationId).finally(() => {
                        pendingMessageReload = false;
                    });
                }
            }, delayMs);
        };

        const unsubscribe = subscribeRealtime((event) => {
            if (event.type === "conversation.changed" || event.type === "message.changed") {
                scheduleConversationReload(0);
                scheduleConversationReload(350);
            }
            if (event.type === "message.changed" && selectedId && event.conversationId === selectedId) {
                scheduleMessageReload(selectedId, 0);
                scheduleMessageReload(selectedId, 250);
            }
            if (event.type === "conversation.changed" && selectedId && event.conversationId === selectedId) {
                scheduleMessageReload(selectedId, 0);
                scheduleMessageReload(selectedId, 250);
            }
        });
        return () => {
            if (conversationReloadTimer != null) {
                window.clearTimeout(conversationReloadTimer);
            }
            if (messageReloadTimer != null) {
                window.clearTimeout(messageReloadTimer);
            }
            unsubscribe();
        };
    }, [selectedId]);

    useEffect(() => {
        async function refreshLiveWorkspace() {
            if (liveWorkspaceRefreshInFlightRef.current) {
                liveWorkspaceRefreshQueuedRef.current = true;
                return;
            }
            if (document.hidden) return;
            liveWorkspaceRefreshInFlightRef.current = true;
            try {
                await loadConversations();
                const activeConversationId = selectedIdRef.current;
                if (activeConversationId) {
                    await loadMessages(activeConversationId);
                }
            } finally {
                liveWorkspaceRefreshInFlightRef.current = false;
                if (liveWorkspaceRefreshQueuedRef.current) {
                    liveWorkspaceRefreshQueuedRef.current = false;
                    window.setTimeout(() => {
                        void refreshLiveWorkspace();
                    }, 180);
                }
            }
        }

        function triggerRefresh() {
            void refreshLiveWorkspace();
        }

        const intervalId = window.setInterval(triggerRefresh, ATENDIMENTOS_AUTO_REFRESH_INTERVAL_MS);
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                triggerRefresh();
            }
        };
        const handleFocus = () => {
            if (!document.hidden) {
                triggerRefresh();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleFocus);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("focus", handleFocus);
        };
    }, []);

    useLayoutEffect(() => {
        if (!selectedId) return;
        const isChatSwitch = previousSelectedIdRef.current !== selectedId;
        previousSelectedIdRef.current = selectedId;
        // Posiciona antes do paint para evitar "piscar no topo e descer".
        if (isChatSwitch) {
            const container = messagesContainerRef.current;
            if (!container) return;
            container.scrollTop = container.scrollHeight;
            return;
        }
        scrollMessagesToBottom("auto");
    }, [selectedId, lastDisplayedMessageToken]);

    useLayoutEffect(() => {
        syncDraftInputHeight();
    }, [selectedChatDraft]);

    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            if (ddiDropdownRef.current && !ddiDropdownRef.current.contains(event.target as Node)) {
                setIsDdiOpen(false);
            }
            if (chatLabelsDropdownRef.current && !chatLabelsDropdownRef.current.contains(event.target as Node)) {
                setIsChatLabelsOpen(false);
            }
            if (advancedFiltersRef.current && !advancedFiltersRef.current.contains(event.target as Node)) {
                setIsAdvancedFiltersOpen(false);
            }
            if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
                setIsSortMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    useEffect(() => {
        function handleAttachmentOutsideClick(event: MouseEvent) {
            if (!attachmentMenuRef.current) return;
            if (!attachmentMenuRef.current.contains(event.target as Node)) {
                setIsAttachmentMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleAttachmentOutsideClick);
        return () => document.removeEventListener("mousedown", handleAttachmentOutsideClick);
    }, []);

    useEffect(() => {
        function handleEmojiPickerOutsideClick(event: MouseEvent) {
            if (!emojiPickerRef.current) return;
            if (!emojiPickerRef.current.contains(event.target as Node)) {
                setIsEmojiPickerOpen(false);
            }
        }
        document.addEventListener("mousedown", handleEmojiPickerOutsideClick);
        return () => document.removeEventListener("mousedown", handleEmojiPickerOutsideClick);
    }, []);

    useEffect(() => {
        setIsAttachmentMenuOpen(false);
        setIsEmojiPickerOpen(false);
    }, [selectedId]);

    useEffect(() => {
        if (!isRecordingAudio && !recordedAudioUrl && !isImagePreviewOpen && !isVideoPreviewOpen) return;
        setIsAttachmentMenuOpen(false);
        setIsEmojiPickerOpen(false);
    }, [isImagePreviewOpen, isRecordingAudio, isVideoPreviewOpen, recordedAudioUrl]);

    useEffect(() => {
        return () => {
            try {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                    mediaRecorderRef.current.stop();
                }
            } catch {
                // Ignora erro de encerramento.
            }
            stopAudioAnalyzer();
            stopAudioStream();
            if (recordedAudioUrl && recordedAudioUrl.startsWith("blob:")) {
                URL.revokeObjectURL(recordedAudioUrl);
            }
        };
    }, [recordedAudioUrl]);

    useEffect(() => {
        const audio = audioPreviewRef.current;
        if (!audio || !recordedAudioUrl) return;
        const syncDuration = () => {
            const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Math.max(0, audioRecordSeconds);
            setRecordedAudioDuration(duration);
        };
        const handleTime = () => setRecordedAudioCurrentTime(audio.currentTime || 0);
        const handlePlay = () => setIsRecordedAudioPlaying(true);
        const handlePause = () => setIsRecordedAudioPlaying(false);
        const handleEnded = () => {
            setIsRecordedAudioPlaying(false);
            setRecordedAudioCurrentTime(0);
        };
        setRecordedAudioCurrentTime(0);
        setIsRecordedAudioPlaying(false);
        syncDuration();
        audio.addEventListener("loadedmetadata", syncDuration);
        audio.addEventListener("durationchange", syncDuration);
        audio.addEventListener("timeupdate", handleTime);
        audio.addEventListener("play", handlePlay);
        audio.addEventListener("pause", handlePause);
        audio.addEventListener("ended", handleEnded);
        return () => {
            audio.removeEventListener("loadedmetadata", syncDuration);
            audio.removeEventListener("durationchange", syncDuration);
            audio.removeEventListener("timeupdate", handleTime);
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audio.removeEventListener("ended", handleEnded);
        };
    }, [recordedAudioUrl, audioRecordSeconds]);

    function handleSelectChat(id: string) {
        setSelectedId(id);
        setMobileView("chat");
        setSendError(null);
        const chat = chats.find((item) => item.id === id);
        markChatAsRead(chat);
    }

    function closeSelectedChatView() {
        setSelectedId("");
        setMessages([]);
        setSendError(null);
        setIsAttachmentMenuOpen(false);
        setIsEmojiPickerOpen(false);
        setIsChatLabelsOpen(false);
        closeContactSidebar();
        setMobileView("list");
        routeSelectionAppliedRef.current = "";

        if (routeConversationId) {
            const nextSearch = new URLSearchParams(searchParams?.toString() ?? "");
            const query = nextSearch.toString();
            router.replace(query ? `/protected/atendimentos?${query}` : "/protected/atendimentos");
        }
    }

    async function loadTransferRoutingOptions() {
        const [teamsRes, usersRes] = await Promise.all([
            fetch("/api/atendimentos/teams", { cache: "no-store" }),
            fetch("/api/atendimentos/users", { cache: "no-store" }),
        ]);
        const teamsData = teamsRes.ok ? ((await teamsRes.json().catch(() => [])) as AtendimentoTeam[]) : [];
        const usersData = usersRes.ok ? ((await usersRes.json().catch(() => [])) as AtendimentoUser[]) : [];
        setTransferTeams(teamsData);
        setTransferUsers(usersData);
        return { teams: teamsData, users: usersData };
    }

    function resetTransferSelection(
        preferredTeamId?: string | null,
        options?: { teams: AtendimentoTeam[]; users: AtendimentoUser[] },
        mode: "manual" | "conversation" = transferMode
    ) {
        const availableTeams = options?.teams ?? transferTeams;
        const availableUsers = options?.users ?? transferUsers;
        const fallbackTeamId = preferredTeamId?.trim() || currentTeamId || availableTeams[0]?.id || "";
        setSelectedTransferTeamId(fallbackTeamId);
        if (!fallbackTeamId) {
            setSelectedTransferUserId("");
            return;
        }
        const preferredUserId =
            mode === "conversation" && selectedChat?.assignedTeamId === fallbackTeamId
                ? selectedChat.assignedUserId ?? ""
                : "";
        const hasPreferredUser = preferredUserId
            ? availableUsers.some((user) => user.id === preferredUserId && user.teamId === fallbackTeamId)
            : false;
        setSelectedTransferUserId(hasPreferredUser ? preferredUserId : "");
    }

    async function handleStartAtendimento() {
        if (!selectedChat || isStarting) return;
        setIsStarting(true);
        setSendError(null);
        try {
            let res = await fetch(`/api/atendimentos/conversations/${selectedChat.id}/start`, { method: "POST" });
            if (!res.ok && selectedChatIsUnassigned && selectedChat.status !== "NEW" && currentUserId) {
                res = await fetch(`/api/atendimentos/conversations/${selectedChat.id}/transfer`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ teamId: currentTeamId, targetUserId: currentUserId }),
                });
            }
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { message?: string } | null;
                setSendError(data?.message ?? "Falha ao iniciar atendimento");
                return;
            }
            await loadConversations();
            await loadMessages(selectedChat.id);
        } finally {
            setIsStarting(false);
        }
    }

    async function handleOpenTransfer() {
        setTransferMode("conversation");
        const routingOptions = await loadTransferRoutingOptions();
        const defaultTeamId = selectedChat?.assignedTeamId ?? currentTeamId;
        resetTransferSelection(defaultTeamId, routingOptions, "conversation");
        setIsTransferOpen(true);
    }

    async function handleTransferAtendimento() {
        if (!selectedTransferTeamId || isTransferring) return;
        setIsTransferring(true);
        setSendError(null);
        try {
            let res: Response;
            if (transferMode === "manual") {
                res = await fetch("/api/atendimentos/conversations/manual", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        phone: manualTargetPhone,
                        teamId: selectedTransferTeamId,
                        assignedUserId: selectedTransferUserId || null,
                    }),
                });
            } else {
                if (!selectedChat) return;
                res = await fetch(`/api/atendimentos/conversations/${selectedChat.id}/transfer`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        teamId: selectedTransferTeamId,
                        targetUserId: selectedTransferUserId || null,
                    }),
                });
            }
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { message?: string } | null;
                setSendError(data?.message ?? "Falha ao transferir atendimento");
                return;
            }
            setIsTransferOpen(false);
            const data = (await res.json().catch(() => null)) as { conversationId?: string } | null;
            await loadConversations();
            if (transferMode === "manual" && data?.conversationId) {
                setSelectedId(data.conversationId);
                setPendingPhone("");
                setManualTargetPhone("");
                setNewChatNumber("");
                setMobileView("chat");
                await loadMessages(data.conversationId);
            } else if (selectedChat) {
                await loadMessages(selectedChat.id);
            }
        } finally {
            setIsTransferring(false);
        }
    }

    function buildPhoneFromFooter() {
        const ddiDigits = normalizePhone(`+${getCountryCallingCode(countryIso)}`);
        const localDigits = normalizePhone(newChatNumber);
        return normalizePhone(`${ddiDigits}${localDigits}`);
    }

    function handleLocalNumberInput(value: string) {
        const digits = normalizePhone(value);
        const ddiDigits = normalizePhone(`+${getCountryCallingCode(countryIso)}`);
        if (digits.startsWith(ddiDigits)) {
            setNewChatNumber(digits.slice(ddiDigits.length));
            return;
        }
        setNewChatNumber(digits);
    }

    function canonicalPhone(value: string) {
        const normalized = normalizePhone(value);
        if (normalized.startsWith("55") && normalized.length === 13 && normalized.charAt(4) === "9") {
            return normalized.slice(0, 4) + normalized.slice(5);
        }
        return normalized;
    }

    async function handleStartConversation() {
        const phone = buildPhoneFromFooter();
        if (!phone) {
            setSendError("Informe um telefone válido para iniciar.");
            return;
        }
        const existing = chats.find((chat) => canonicalPhone(chat.phone) === canonicalPhone(phone));
        if (existing) {
            setSelectedId(existing.id);
            setMobileView("chat");
            setPendingPhone("");
            setSendError(null);
            return;
        }
        setTransferMode("manual");
        setManualTargetPhone(phone);
        setSendError(null);
        const routingOptions = await loadTransferRoutingOptions();
        resetTransferSelection(currentTeamId, routingOptions, "manual");
        setIsTransferOpen(true);
    }

    function setDraftForChat(chatId: string, value: string) {
        if (!chatId) return;
        setDraftsByChatId((previous) => {
            const next = { ...previous };
            if (value === "") delete next[chatId];
            else next[chatId] = value;
            return next;
        });
    }

    function clearDraftForChat(chatId: string | null | undefined) {
        if (!chatId) return;
        setDraftsByChatId((previous) => {
            if (!(chatId in previous)) return previous;
            const next = { ...previous };
            delete next[chatId];
            return next;
        });
    }

    function getDraftPreview(value: string) {
        return value.replace(/\s+/g, " ").trim();
    }

    async function handleSendMessage() {
        const value = selectedChatDraftTrimmed;
        const phone = selectedChat?.phone ?? (pendingPhone || buildPhoneFromFooter());
        if (!value || !phone || isSendingText) return;
        const targetChatId = selectedChat?.id ?? selectedId;

        setSendError(null);
        setIsSendingText(true);

        try {
            const res = await fetch("/api/atendimentos/send-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, message: value }),
            });

            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { message?: string } | null;
                setSendError(data?.message ?? "Falha ao enviar mensagem");
                return;
            }
            const data = (await res.json().catch(() => null)) as SendTextResult | null;
            await loadConversations();
            if (data?.conversationId) {
                setSelectedId(data.conversationId);
                setMobileView("chat");
                await loadMessages(data.conversationId);
            } else if (selectedChat) {
                await loadMessages(selectedChat.id);
            }
            clearDraftForChat(targetChatId);
            if (data?.conversationId && data.conversationId !== targetChatId) {
                clearDraftForChat(data.conversationId);
            }
            if (!selectedChat) {
                setPendingPhone("");
                setNewChatNumber("");
            }
        } finally {
            setIsSendingText(false);
        }
    }

    function handleInsertEmoji(emoji: string) {
        const input = draftInputRef.current;
        const selectionStart = input?.selectionStart ?? selectedChatDraft.length;
        const selectionEnd = input?.selectionEnd ?? selectedChatDraft.length;
        const nextValue = `${selectedChatDraft.slice(0, selectionStart)}${emoji}${selectedChatDraft.slice(selectionEnd)}`;
        const nextCursorPosition = selectionStart + emoji.length;

        if (selectedId) {
            setDraftForChat(selectedId, nextValue);
        }

        requestAnimationFrame(() => {
            if (!draftInputRef.current) return;
            draftInputRef.current.focus();
            draftInputRef.current.setSelectionRange(nextCursorPosition, nextCursorPosition);
        });
    }

    function syncDraftInputHeight() {
        const input = draftInputRef.current;
        if (!input) return;
        input.style.height = "0px";
        input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
    }

    function readFileAsDataUrl(file: File) {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
            reader.readAsDataURL(file);
        });
    }

    function extractFirstFile(files: Iterable<File>) {
        for (const file of files) {
            return file;
        }
        return null;
    }

    function hasSupportedDroppedMediaTransfer(dataTransfer: DataTransfer | null) {
        if (!dataTransfer) return false;
        const types = new Set(Array.from(dataTransfer.types ?? []));
        if (types.has("Files") || Array.from(dataTransfer.items ?? []).some((item) => item.kind === "file")) {
            return true;
        }
        return DROP_URI_TRANSFER_TYPES.some((type) => types.has(type)) || types.has("text/html") || types.has("text/plain");
    }

    function getFirstFileFromDataTransfer(dataTransfer: DataTransfer | null) {
        if (!dataTransfer) return null;
        for (const item of Array.from(dataTransfer.items ?? [])) {
            if (item.kind !== "file") continue;
            const file = item.getAsFile();
            if (file) return file;
        }
        return extractFirstFile(Array.from(dataTransfer.files ?? []));
    }

    function getFirstImageFileFromClipboard(dataTransfer: DataTransfer | null) {
        if (!dataTransfer) return null;
        for (const item of Array.from(dataTransfer.items ?? [])) {
            if (item.kind !== "file") continue;
            const file = item.getAsFile();
            if (file && isImageFile(file)) return file;
        }
        return null;
    }

    function getTransferTextByTypes(dataTransfer: DataTransfer | null, types: string[]) {
        if (!dataTransfer) return "";
        for (const type of types) {
            const value = dataTransfer.getData(type).trim();
            if (value) return value;
        }
        return "";
    }

    function getDroppedMediaCandidate(dataTransfer: DataTransfer | null): DroppedMediaCandidate {
        if (!dataTransfer) {
            return { kind: "error", message: "Arraste uma imagem, vídeo ou documento para abrir ou enviar." };
        }

        const firstFile = getFirstFileFromDataTransfer(dataTransfer);
        if (firstFile) {
            return { kind: "file", file: firstFile, mediaKind: getDroppedFileMediaKind(firstFile) };
        }

        const uriValue = getTransferTextByTypes(dataTransfer, DROP_URI_TRANSFER_TYPES);
        const uriUrl = normalizeDroppedImageUrl(extractFirstUriFromTransferText(uriValue) ?? "");
        if (uriUrl) {
            return { kind: "url", url: uriUrl };
        }

        const htmlImageUrl = extractImageSourceFromHtml(getTransferTextByTypes(dataTransfer, ["text/html"]));
        if (htmlImageUrl) {
            return { kind: "url", url: htmlImageUrl };
        }

        const plainTextUrl = normalizeDroppedImageUrl(getTransferTextByTypes(dataTransfer, ["text/plain"]));
        if (plainTextUrl) {
            return { kind: "url", url: plainTextUrl };
        }

        return {
            kind: "error",
            message:
                "Não encontramos um arquivo utilizável nesse conteúdo arrastado. Para vídeos e documentos vindos do navegador, arraste o arquivo do computador. Para imagens, você também pode salvar ou copiar e colar.",
        };
    }

    async function createFileFromBlob(blob: Blob, source: string, fallbackType?: string | null) {
        const type = blob.type || String(fallbackType ?? "").trim() || "application/octet-stream";
        const fileName = inferDroppedImageFileName(source, type);
        return new File([blob], fileName, { type });
    }

    async function dataUrlToFile(dataUrl: string) {
        const response = await fetch(dataUrl);
        if (!response.ok) {
            throw new Error("Não foi possível ler a imagem arrastada.");
        }
        const blob = await response.blob();
        return createFileFromBlob(blob, dataUrl, blob.type);
    }

    async function blobUrlToFile(blobUrl: string) {
        let response: Response;
        try {
            response = await fetch(blobUrl);
        } catch {
            throw new Error(
                "Não foi possível acessar essa imagem arrastada do navegador. Se necessário, salve a imagem no computador ou copie e cole no campo da mensagem."
            );
        }

        if (!response.ok) {
            throw new Error(
                "Não foi possível acessar essa imagem arrastada do navegador. Se necessário, salve a imagem no computador ou copie e cole no campo da mensagem."
            );
        }

        const blob = await response.blob();
        return createFileFromBlob(blob, blobUrl, blob.type);
    }

    async function remoteUrlToFile(url: string) {
        const response = await fetch("/api/atendimentos/dropped-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });

        if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { message?: string } | null;
            throw new Error(data?.message ?? "Não foi possível carregar a imagem arrastada.");
        }

        const blob = await response.blob();
        const fileName =
            parseContentDispositionFileName(response.headers.get("Content-Disposition")) ||
            sanitizeFileName(response.headers.get("X-Dropped-Image-Name") ?? "") ||
            inferDroppedImageFileName(url, blob.type);

        return new File([blob], fileName, { type: blob.type || "application/octet-stream" });
    }

    async function normalizeDroppedMediaCandidate(candidate: DroppedMediaCandidate): Promise<DroppedMediaResolution> {
        if (candidate.kind === "error") return candidate;
        if (candidate.kind === "file") return candidate;

        const normalizedUrl = normalizeDroppedImageUrl(candidate.url);
        if (!normalizedUrl) {
            return {
                kind: "error",
                message:
                    "Não encontramos um arquivo utilizável nesse conteúdo arrastado. Para vídeos e documentos vindos do navegador, arraste o arquivo do computador. Para imagens, você também pode salvar ou copiar e colar.",
            };
        }

        try {
            if (normalizedUrl.startsWith("data:")) {
                return { kind: "file", file: await dataUrlToFile(normalizedUrl), mediaKind: "image" };
            }
            if (normalizedUrl.startsWith("blob:")) {
                return { kind: "file", file: await blobUrlToFile(normalizedUrl), mediaKind: "image" };
            }
            if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
                return { kind: "file", file: await remoteUrlToFile(normalizedUrl), mediaKind: "image" };
            }

            return {
                kind: "error",
                message:
                    "Não encontramos um arquivo utilizável nesse conteúdo arrastado. Para vídeos e documentos vindos do navegador, arraste o arquivo do computador. Para imagens, você também pode salvar ou copiar e colar.",
            };
        } catch (error) {
            return {
                kind: "error",
                message: error instanceof Error ? error.message : "Não foi possível carregar a imagem arrastada.",
            };
        }
    }

    async function resolveDroppedMedia(dataTransfer: DataTransfer | null) {
        const candidate = getDroppedMediaCandidate(dataTransfer);
        return normalizeDroppedMediaCandidate(candidate);
    }

    function getOutgoingPhone() {
        const phone = selectedChat?.phone ?? (pendingPhone || buildPhoneFromFooter());
        if (!phone) {
            setSendError("Informe um telefone válido para iniciar.");
            return null;
        }
        return phone;
    }

    function addPendingMediaMessage(payload: {
        chatId: string;
        type: "image" | "video" | "audio" | "document";
        text: string;
        mediaUrl: string;
        fileName?: string;
    }) {
        const tempId = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const fallbackText =
            payload.type === "image"
                ? "[Imagem]"
                : payload.type === "video"
                  ? "[Vídeo]"
                  : payload.type === "audio"
                    ? "[Áudio]"
                    : "[Documento]";
        const pendingMessage: Message = {
            id: tempId,
            chatId: payload.chatId,
            text: payload.text || fallbackText,
            type: payload.type,
            imageUrl: payload.type === "image" ? payload.mediaUrl : null,
            videoUrl: payload.type === "video" ? payload.mediaUrl : null,
            audioUrl: payload.type === "audio" ? payload.mediaUrl : null,
            documentUrl: payload.type === "document" ? payload.mediaUrl : null,
            documentName: payload.type === "document" ? payload.fileName ?? null : null,
            fromMe: true,
            at: formatTime(new Date().toISOString()),
            status: "SENT",
            pending: true,
            pendingLabel:
                payload.type === "video"
                    ? "Enviando vídeo..."
                    : payload.type === "image"
                      ? "Enviando imagem..."
                      : payload.type === "audio"
                        ? "Enviando áudio..."
                        : "Enviando documento...",
            pendingProgress: payload.type === "video" ? 0 : null,
        };
        setPendingMessages((previous) => [...previous, pendingMessage]);
        return tempId;
    }

    function removePendingMessage(messageId: string) {
        setPendingMessages((previous) => previous.filter((message) => message.id !== messageId));
    }

    function updatePendingMessage(
        messageId: string,
        patch: Partial<Pick<Message, "pendingLabel" | "pendingProgress" | "text" | "imageUrl" | "videoUrl" | "audioUrl" | "documentUrl" | "documentName">>
    ) {
        setPendingMessages((previous) =>
            previous.map((message) => (message.id === messageId ? { ...message, ...patch } : message))
        );
    }

    function resetAudioWaveform() {
        setAudioWaveform(Array.from({ length: AUDIO_WAVE_BARS }, () => 0.08));
    }

    function stopAudioAnalyzer() {
        if (audioAnimationFrameRef.current != null) {
            window.cancelAnimationFrame(audioAnimationFrameRef.current);
            audioAnimationFrameRef.current = null;
        }
        if (audioTimerRef.current != null) {
            window.clearInterval(audioTimerRef.current);
            audioTimerRef.current = null;
        }
        if (audioContextRef.current) {
            void audioContextRef.current.close();
            audioContextRef.current = null;
        }
        audioAnalyserRef.current = null;
    }

    function stopAudioStream() {
        if (!audioStreamRef.current) return;
        for (const track of audioStreamRef.current.getTracks()) {
            track.stop();
        }
        audioStreamRef.current = null;
    }

    function clearRecordedAudio() {
        if (audioPreviewRef.current) {
            audioPreviewRef.current.pause();
            audioPreviewRef.current.currentTime = 0;
        }
        if (recordedAudioUrl && recordedAudioUrl.startsWith("blob:")) {
            URL.revokeObjectURL(recordedAudioUrl);
        }
        setRecordedAudioBlob(null);
        setRecordedAudioUrl(null);
        setAudioRecordSeconds(0);
        setIsRecordedAudioPlaying(false);
        setRecordedAudioCurrentTime(0);
        setRecordedAudioDuration(0);
        resetAudioWaveform();
    }

    function toggleRecordedAudioPlayback() {
        const audio = audioPreviewRef.current;
        if (!audio) return;
        if (audio.paused) {
            void audio.play();
            return;
        }
        audio.pause();
    }

    function seekRecordedAudio(event: React.MouseEvent<HTMLButtonElement>) {
        const audio = audioPreviewRef.current;
        if (!audio) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const fallbackDuration = Math.max(0, recordedAudioDuration || audioRecordSeconds);
        if (fallbackDuration <= 0) return;
        audio.currentTime = fallbackDuration * ratio;
        setRecordedAudioCurrentTime(audio.currentTime);
    }

    function monitorAudioWaveform(analyser: AnalyserNode) {
        const data = new Uint8Array(analyser.fftSize);
        let lastUpdateAt = 0;
        const loop = () => {
            analyser.getByteTimeDomainData(data);
            let peak = 0;
            for (let i = 0; i < data.length; i += 1) {
                const normalized = Math.abs((data[i] - 128) / 128);
                if (normalized > peak) peak = normalized;
            }
            const now = performance.now();
            if (now - lastUpdateAt >= AUDIO_WAVE_UPDATE_INTERVAL_MS) {
                lastUpdateAt = now;
                setAudioWaveform((previous) => {
                    const next = previous.slice(1);
                    next.push(Math.max(0.08, Math.min(1, peak * 1.8)));
                    return next;
                });
            }
            audioAnimationFrameRef.current = window.requestAnimationFrame(loop);
        };
        audioAnimationFrameRef.current = window.requestAnimationFrame(loop);
    }

    async function startAudioRecording() {
        if (isRecordingAudio || isSendingMedia) return;
        setSendError(null);
        clearRecordedAudio();

        if (!navigator.mediaDevices?.getUserMedia) {
            setSendError("Gravação de áudio não suportada neste navegador.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
                const url = URL.createObjectURL(blob);
                setRecordedAudioBlob(blob);
                setRecordedAudioUrl(url);
                const elapsedSeconds = Math.max(1, Math.round((Date.now() - audioRecordingStartRef.current) / 1000));
                setAudioRecordSeconds(elapsedSeconds);
                const probe = document.createElement("audio");
                probe.preload = "metadata";
                probe.src = url;
                probe.onloadedmetadata = () => {
                    const metadataDuration = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : elapsedSeconds;
                    const metadataSeconds = Math.max(1, Math.round(metadataDuration));
                    setAudioRecordSeconds(metadataSeconds);
                };
                setIsRecordingAudio(false);
                stopAudioAnalyzer();
                stopAudioStream();
            };

            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 128;
            source.connect(analyser);
            audioAnalyserRef.current = analyser;

            audioRecordingStartRef.current = Date.now();
            setAudioRecordSeconds(0);
            resetAudioWaveform();
            audioTimerRef.current = window.setInterval(() => {
                const elapsed = Math.floor((Date.now() - audioRecordingStartRef.current) / 1000);
                setAudioRecordSeconds(elapsed);
            }, 200);
            monitorAudioWaveform(analyser);

            recorder.start(150);
            setIsRecordingAudio(true);
            setIsAttachmentMenuOpen(false);
        } catch {
            stopAudioAnalyzer();
            stopAudioStream();
            setIsRecordingAudio(false);
            setSendError("Não foi possível acessar o microfone.");
        }
    }

    function stopAudioRecording() {
        if (!isRecordingAudio) return;
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - audioRecordingStartRef.current) / 1000));
        setAudioRecordSeconds(elapsedSeconds);
        if (recorder.state !== "inactive") recorder.stop();
    }

    async function sendRecordedAudio() {
        const phone = getOutgoingPhone();
        if (!phone || !recordedAudioBlob || isSendingMedia) return;
        const targetChatId = selectedChat?.id ?? selectedId;
        if (!targetChatId) {
            setSendError("Selecione uma conversa para enviar o áudio.");
            return;
        }

        setSendError(null);
        setIsSendingMedia(true);
        const previewUrl = recordedAudioUrl ?? URL.createObjectURL(recordedAudioBlob);
        const pendingId = addPendingMediaMessage({
            chatId: targetChatId,
            type: "audio",
            text: "[Audio]",
            mediaUrl: previewUrl,
        });

        try {
            const audioDataUrl = await blobToDataUrl(recordedAudioBlob);
            const res = await fetch("/api/atendimentos/send-audio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone,
                    audio: audioDataUrl,
                    waveform: true,
                    async: true,
                    viewOnce: false,
                    delayTyping: 0,
                }),
            });

            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { message?: string } | null;
                setSendError(data?.message ?? "Falha ao enviar áudio");
                removePendingMessage(pendingId);
                return;
            }

            const data = (await res.json().catch(() => null)) as SendTextResult | null;
            removePendingMessage(pendingId);
            await loadConversations();
            if (data?.conversationId) {
                setSelectedId(data.conversationId);
                setMobileView("chat");
                await loadMessages(data.conversationId);
            } else if (selectedChat) {
                await loadMessages(selectedChat.id);
            }
            clearRecordedAudio();
            if (!selectedChat) {
                setPendingPhone("");
                setNewChatNumber("");
            }
        } catch {
            removePendingMessage(pendingId);
            setSendError("Falha ao enviar áudio");
        } finally {
            setIsSendingMedia(false);
        }
    }

    function openMediaViewer(message: Message, kind: "image" | "video", source: string) {
        const sender = message.fromMe ? "Você" : (selectedChat?.name ?? "Contato");
        setMediaViewer({
            type: kind,
            source,
            sender,
            senderPhotoUrl: message.fromMe ? null : (selectedChat?.photoUrl ?? null),
            senderAvatarText: toInitials(sender),
            at: message.at,
        });
    }

    async function handleDownloadMedia() {
        if (!mediaViewer || isDownloadingMedia) return;
        setIsDownloadingMedia(true);
        const extension = mediaViewer.type === "image" ? "jpg" : "mp4";
        const filename = `${mediaViewer.type}-${Date.now()}.${extension}`;

        try {
            const response = await fetch(mediaViewer.source);
            if (!response.ok) throw new Error("download_failed");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch {
            window.open(mediaViewer.source, "_blank", "noopener,noreferrer");
        } finally {
            setIsDownloadingMedia(false);
        }
    }

    async function handleDownloadDocument(source: string, fileName?: string | null) {
        if (!source) return;
        const fallbackExtension = source.startsWith("data:") ? (source.match(/^data:([^/]+\/)?([a-z0-9.+-]+);/i)?.[2] ?? "bin") : "bin";
        const filename = (fileName && fileName.trim()) || `documento-${Date.now()}.${fallbackExtension.replace(/[^a-z0-9]+/gi, "") || "bin"}`;
        try {
            const response = await fetch(source);
            if (!response.ok) throw new Error("download_failed");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch {
            window.open(source, "_blank", "noopener,noreferrer");
        }
    }

    async function handleSendImage(imageDataUrl: string, caption: string) {
        const phone = getOutgoingPhone();
        if (!phone || !imageDataUrl || isSendingMedia) return;
        const estimatedSize = estimateDataUrlBytes(imageDataUrl);
        if (estimatedSize > MAX_IMAGE_BYTES) {
            setSendError(`Imagem muito pesada (${formatBytes(estimatedSize)}). Limite: 5 MB.`);
            return;
        }
        const targetChatId = selectedChat?.id ?? selectedId;
        if (!targetChatId) {
            setSendError("Selecione uma conversa para enviar a imagem.");
            return;
        }
        setSendError(null);
        setIsSendingMedia(true);
        const pendingId = addPendingMediaMessage({
            chatId: targetChatId,
            type: "image",
            text: caption,
            mediaUrl: imageDataUrl,
        });

        try {
            const res = await fetch("/api/atendimentos/send-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone,
                    image: imageDataUrl,
                    caption: caption || undefined,
                    viewOnce: false,
                }),
            });

            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { message?: string } | null;
                setSendError(data?.message ?? "Falha ao enviar imagem");
                removePendingMessage(pendingId);
                return;
            }

            const data = (await res.json().catch(() => null)) as SendTextResult | null;
            removePendingMessage(pendingId);
            await loadConversations();
            if (data?.conversationId) {
                setSelectedId(data.conversationId);
                setMobileView("chat");
                await loadMessages(data.conversationId);
            } else if (selectedChat) {
                await loadMessages(selectedChat.id);
            }

            clearDraftForChat(targetChatId);
            if (data?.conversationId && data.conversationId !== targetChatId) {
                clearDraftForChat(data.conversationId);
            }
            if (!selectedChat) {
                setPendingPhone("");
                setNewChatNumber("");
            }
        } catch {
            removePendingMessage(pendingId);
            setSendError("Falha ao enviar imagem");
        } finally {
            setIsSendingMedia(false);
        }
    }

    async function handleSendDocument(file: File) {
        const phone = getOutgoingPhone();
        if (!phone || isSendingMedia) return;
        const extension = getDocumentExtension(file.name);
        if (!extension) {
            setSendError("Não foi possível identificar a extensão do documento.");
            return;
        }
        const targetChatId = selectedChat?.id ?? selectedId;
        if (!targetChatId) {
            setSendError("Selecione uma conversa para enviar o documento.");
            return;
        }

        setSendError(null);
        setIsAttachmentMenuOpen(false);
        setIsSendingMedia(true);
        const caption = selectedChatDraftTrimmed;
        let pendingId: string | null = null;

        try {
            const documentDataUrl = await readFileAsDataUrl(file);
            pendingId = addPendingMediaMessage({
                chatId: targetChatId,
                type: "document",
                text: caption || file.name,
                mediaUrl: documentDataUrl,
                fileName: file.name,
            });
            const res = await fetch("/api/atendimentos/send-document", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone,
                    document: documentDataUrl,
                    extension,
                    fileName: file.name,
                    caption: caption || undefined,
                }),
            });

            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { message?: string } | null;
                setSendError(data?.message ?? "Falha ao enviar documento");
                if (pendingId) removePendingMessage(pendingId);
                return;
            }

            const data = (await res.json().catch(() => null)) as SendTextResult | null;
            if (pendingId) removePendingMessage(pendingId);
            await loadConversations();
            if (data?.conversationId) {
                setSelectedId(data.conversationId);
                setMobileView("chat");
                await loadMessages(data.conversationId);
            } else if (selectedChat) {
                await loadMessages(selectedChat.id);
            }

            clearDraftForChat(targetChatId);
            if (data?.conversationId && data.conversationId !== targetChatId) {
                clearDraftForChat(data.conversationId);
            }
            if (!selectedChat) {
                setPendingPhone("");
                setNewChatNumber("");
            }
        } catch {
            if (pendingId) removePendingMessage(pendingId);
            setSendError("Falha ao enviar documento");
        } finally {
            setIsSendingMedia(false);
        }
    }

    function clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value));
    }

    function saveEditorSnapshot() {
        const canvas = imageEditorCanvasRef.current;
        if (!canvas || canvas.width === 0 || canvas.height === 0) return;
        const snapshot = {
            imageData: canvas.toDataURL("image/png"),
            textLayers: imageTextLayers.map((layer) => ({ ...layer })),
        };
        setEditorHistory((previous) => [...previous.slice(-24), snapshot]);
    }

    function undoEditorChange() {
        setEditorHistory((previous) => {
            if (!previous.length) return previous;
            const snapshot = previous[previous.length - 1];
            const image = new Image();
            image.onload = () => {
                const canvas = imageEditorCanvasRef.current;
                if (!canvas) return;
                canvas.width = image.width;
                canvas.height = image.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0);
                imageEditorBaseImageRef.current = image;
                setImageTextLayers(snapshot.textLayers.map((layer) => ({ ...layer })));
                setCropBox(null);
                cropBoxRef.current = null;
            };
            image.src = snapshot.imageData;
            return previous.slice(0, -1);
        });
    }

    function getCanvasPoint(clientX: number, clientY: number) {
        const canvas = imageEditorCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: clamp((clientX - rect.left) * scaleX, 0, canvas.width),
            y: clamp((clientY - rect.top) * scaleY, 0, canvas.height),
        };
    }

    function handleEditorPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
        const canvas = imageEditorCanvasRef.current;
        const point = getCanvasPoint(event.clientX, event.clientY);
        if (!canvas || !point) return;
        if (imageEditorMode === "draw") {
            saveEditorSnapshot();
            isDrawingRef.current = true;
            lastDrawPointRef.current = point;
            return;
        }
        if (imageEditorMode === "crop") {
            cropStartRef.current = point;
            const nextCrop = { x: point.x, y: point.y, w: 0, h: 0 };
            cropBoxRef.current = nextCrop;
            setCropBox(nextCrop);
        }
    }

    function handleEditorPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
        const canvas = imageEditorCanvasRef.current;
        const point = getCanvasPoint(event.clientX, event.clientY);
        if (!canvas || !point) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (imageEditorMode === "draw" && isDrawingRef.current) {
            const previous = lastDrawPointRef.current;
            if (!previous) {
                lastDrawPointRef.current = point;
                return;
            }
            ctx.strokeStyle = imageDrawColor;
            ctx.lineWidth = imageDrawSize;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(previous.x, previous.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
            lastDrawPointRef.current = point;
            return;
        }

        if (imageEditorMode === "crop" && cropStartRef.current) {
            const start = cropStartRef.current;
            const x = Math.min(start.x, point.x);
            const y = Math.min(start.y, point.y);
            const w = Math.abs(point.x - start.x);
            const h = Math.abs(point.y - start.y);
            const nextCrop = { x, y, w, h };
            cropBoxRef.current = nextCrop;
            setCropBox(nextCrop);
        }
    }

    function handleEditorPointerUp() {
        if (imageEditorMode === "crop" && cropBoxRef.current && cropBoxRef.current.w >= 10 && cropBoxRef.current.h >= 10) {
            applyCropToEditor(cropBoxRef.current);
        }
        isDrawingRef.current = false;
        lastDrawPointRef.current = null;
        cropStartRef.current = null;
    }

    function addTextLayer() {
        const canvas = imageEditorCanvasRef.current;
        if (!canvas) return;
        saveEditorSnapshot();
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const layer: ImageTextLayer = {
            id,
            text: "Digite aqui",
            x: Math.max(12, Math.round(canvas.width * 0.18)),
            y: Math.max(16, Math.round(canvas.height * 0.2)),
            color: imageDrawColor,
            fontSize: 32,
            boxWidth: 220,
            rotation: 0,
        };
        setImageTextLayers((previous) => [...previous, layer]);
        setSelectedTextLayerId(id);
        setImageEditorMode("text");
    }

    function updateTextLayer(id: string, updater: (layer: ImageTextLayer) => ImageTextLayer) {
        setImageTextLayers((previous) => previous.map((layer) => (layer.id === id ? updater(layer) : layer)));
    }

    function handleTextDragStart(layerId: string, event: React.PointerEvent<HTMLButtonElement>) {
        const point = getCanvasPoint(event.clientX, event.clientY);
        const target = imageTextLayers.find((layer) => layer.id === layerId);
        if (!point || !target) return;
        saveEditorSnapshot();
        event.preventDefault();
        event.stopPropagation();
        setSelectedTextLayerId(layerId);
        textDragRef.current = {
            id: layerId,
            offsetX: point.x - target.x,
            offsetY: point.y - target.y,
        };
    }

    function handleTextResizeStart(layerId: string, event: React.PointerEvent<HTMLButtonElement>) {
        const point = getCanvasPoint(event.clientX, event.clientY);
        const target = imageTextLayers.find((layer) => layer.id === layerId);
        if (!point || !target) return;
        saveEditorSnapshot();
        event.preventDefault();
        event.stopPropagation();
        setSelectedTextLayerId(layerId);
        textResizeRef.current = {
            id: layerId,
            startX: point.x,
            startY: point.y,
            startWidth: target.boxWidth,
            startFontSize: target.fontSize,
        };
    }

    function handleEditorStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const canvas = imageEditorCanvasRef.current;
        if (!canvas) return;
        const point = getCanvasPoint(event.clientX, event.clientY);
        if (!point) return;
        const drag = textDragRef.current;
        if (drag) {
            const target = imageTextLayers.find((layer) => layer.id === drag.id);
            if (!target) return;
            const x = clamp(point.x - drag.offsetX, 0, Math.max(0, canvas.width - 60));
            const y = clamp(point.y - drag.offsetY, 0, Math.max(0, canvas.height - target.fontSize));
            updateTextLayer(drag.id, (layer) => ({ ...layer, x, y }));
            return;
        }

        const resize = textResizeRef.current;
        if (resize) {
            const dx = point.x - resize.startX;
            const dy = point.y - resize.startY;
            const delta = (dx + dy) / 2;
            const nextWidth = clamp(Math.round(resize.startWidth + delta), 100, Math.max(100, canvas.width));
            const nextFont = clamp(Math.round(resize.startFontSize + delta / 8), 14, 96);
            updateTextLayer(resize.id, (layer) => ({ ...layer, boxWidth: nextWidth, fontSize: nextFont }));
        }
    }

    function stopTextDrag() {
        textDragRef.current = null;
        textResizeRef.current = null;
    }

    function rotateImage(direction: "cw" | "ccw") {
        const canvas = imageEditorCanvasRef.current;
        if (!canvas) return;
        saveEditorSnapshot();
        const source = document.createElement("canvas");
        source.width = canvas.width;
        source.height = canvas.height;
        const sourceCtx = source.getContext("2d");
        if (!sourceCtx) return;
        sourceCtx.drawImage(canvas, 0, 0);

        const oldW = source.width;
        const oldH = source.height;
        const nextW = oldH;
        const nextH = oldW;

        canvas.width = nextW;
        canvas.height = nextH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, nextW, nextH);
        ctx.save();
        if (direction === "cw") {
            ctx.translate(nextW, 0);
            ctx.rotate(Math.PI / 2);
        } else {
            ctx.translate(0, nextH);
            ctx.rotate(-Math.PI / 2);
        }
        ctx.drawImage(source, 0, 0);
        ctx.restore();

        setImageTextLayers((previous) =>
            previous.map((layer) => {
                const layerHeight = Math.max(layer.fontSize * 2, 32);
                if (direction === "cw") {
                    const x = clamp(oldH - (layer.y + layerHeight), 0, Math.max(0, nextW - layer.boxWidth));
                    const y = clamp(layer.x, 0, Math.max(0, nextH - layer.fontSize));
                    return { ...layer, x, y, rotation: layer.rotation + 90 };
                }
                const x = clamp(layer.y, 0, Math.max(0, nextW - layer.boxWidth));
                const y = clamp(oldW - (layer.x + layer.boxWidth), 0, Math.max(0, nextH - layer.fontSize));
                return { ...layer, x, y, rotation: layer.rotation - 90 };
            })
        );

        const refreshed = new Image();
        refreshed.onload = () => {
            imageEditorBaseImageRef.current = refreshed;
        };
        refreshed.src = canvas.toDataURL("image/png");
        imageEditorBaseImageRef.current = refreshed;
        setCropBox(null);
    }

    function restoreEditorBaseImage() {
        const canvas = imageEditorCanvasRef.current;
        const base = imageEditorBaseImageRef.current;
        if (!canvas || !base) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
        setImageTextLayers([]);
        setSelectedTextLayerId(null);
        setCropBox(null);
    }

    function applyCropToEditor(overrideCrop?: { x: number; y: number; w: number; h: number }) {
        const canvas = imageEditorCanvasRef.current;
        const crop = overrideCrop ?? cropBox;
        if (!canvas || !crop || crop.w < 10 || crop.h < 10) return;
        saveEditorSnapshot();
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const x = clamp(Math.round(crop.x), 0, Math.max(0, canvas.width - 1));
        const y = clamp(Math.round(crop.y), 0, Math.max(0, canvas.height - 1));
        const maxW = canvas.width - x;
        const maxH = canvas.height - y;
        const w = clamp(Math.round(crop.w), 1, maxW);
        const h = clamp(Math.round(crop.h), 1, maxH);

        const temp = document.createElement("canvas");
        temp.width = w;
        temp.height = h;
        const tempCtx = temp.getContext("2d");
        if (!tempCtx) return;
        tempCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(temp, 0, 0);

        setImageTextLayers((previous) =>
            previous
                .map((layer) => ({ ...layer, x: layer.x - x, y: layer.y - y }))
                .filter((layer) => layer.x < w && layer.y < h && layer.x + layer.boxWidth > 0 && layer.y + layer.fontSize > 0)
                .map((layer) => ({
                    ...layer,
                    x: clamp(layer.x, 0, Math.max(0, w - layer.boxWidth)),
                    y: clamp(layer.y, 0, Math.max(0, h - layer.fontSize)),
                }))
        );

        const refreshed = new Image();
        refreshed.onload = () => {
            imageEditorBaseImageRef.current = refreshed;
        };
        refreshed.src = temp.toDataURL("image/png");
        setCropBox(null);
        cropBoxRef.current = null;
        imageEditorBaseImageRef.current = refreshed;
    }

    function closeImagePreview() {
        setIsImagePreviewOpen(false);
        setImagePreviewSource("");
        setImagePreviewCaption("");
        setEditorHistory([]);
        setImageTextLayers([]);
        setSelectedTextLayerId(null);
        stopTextDrag();
        cropBoxRef.current = null;
        setCropBox(null);
    }

    async function confirmImageSendFromPreview() {
        const canvas = imageEditorCanvasRef.current;
        if (!canvas) return;
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const exportCtx = exportCanvas.getContext("2d");
        if (!exportCtx) return;
        exportCtx.drawImage(canvas, 0, 0);
        for (const layer of imageTextLayers) {
            const value = layer.text.trim();
            if (!value) continue;
            const lines = value.split("\n");
            const lineHeight = Math.round(layer.fontSize * 1.15);
            exportCtx.save();
            exportCtx.translate(layer.x, layer.y);
            exportCtx.rotate((layer.rotation * Math.PI) / 180);
            exportCtx.font = `bold ${layer.fontSize}px sans-serif`;
            exportCtx.fillStyle = layer.color;
            exportCtx.strokeStyle = "rgba(0,0,0,0.45)";
            exportCtx.lineWidth = 2;
            lines.forEach((line, index) => {
                const y = layer.fontSize + index * lineHeight;
                exportCtx.strokeText(line, 0, y, layer.boxWidth);
                exportCtx.fillText(line, 0, y, layer.boxWidth);
            });
            exportCtx.restore();
        }
        const image = exportCanvas.toDataURL("image/jpeg", 0.92);
        const caption = imagePreviewCaption.trim();
        closeImagePreview();
        void handleSendImage(image, caption);
    }

    async function openImagePreview(file: File) {
        setSendError(null);
        if (!isImageFile(file)) {
            setSendError("Selecione um arquivo de imagem válido.");
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            setSendError(`Imagem muito pesada (${formatBytes(file.size)}). Limite: 5 MB.`);
            return;
        }
        try {
            const base64 = await readFileAsDataUrl(file);
            setIsAttachmentMenuOpen(false);
            setImagePreviewCaption(selectedChatDraftTrimmed);
            setImagePreviewSource(base64);
            setEditorHistory([]);
            setImageEditorMode("draw");
            setImageTextLayers([]);
            setSelectedTextLayerId(null);
            cropBoxRef.current = null;
            setCropBox(null);
            setIsImagePreviewOpen(true);
        } catch (error) {
            setSendError(error instanceof Error ? error.message : "Não foi possível abrir a imagem no editor.");
        }
    }

    function handleDraftPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
        const file = getFirstImageFileFromClipboard(event.clipboardData);
        if (!file) return;
        event.preventDefault();
        void openImagePreview(file);
    }

    function handleChatDragEnter(event: React.DragEvent<HTMLElement>) {
        if (!hasSupportedDroppedMediaTransfer(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        messageDropDepthRef.current += 1;
        setIsMessageDropActive(true);
    }

    function handleChatDragOver(event: React.DragEvent<HTMLElement>) {
        if (!hasSupportedDroppedMediaTransfer(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
        setIsMessageDropActive(true);
    }

    function handleChatDragLeave(event: React.DragEvent<HTMLElement>) {
        if (!hasSupportedDroppedMediaTransfer(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        messageDropDepthRef.current = Math.max(0, messageDropDepthRef.current - 1);
        if (messageDropDepthRef.current === 0) {
            setIsMessageDropActive(false);
        }
    }

    async function handleChatDrop(event: React.DragEvent<HTMLElement>) {
        if (!hasSupportedDroppedMediaTransfer(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        const dataTransfer = event.dataTransfer;
        messageDropDepthRef.current = 0;
        setIsMessageDropActive(false);
        setIsResolvingDroppedMedia(true);
        try {
            const resolution = await resolveDroppedMedia(dataTransfer);
            if (resolution.kind === "error") {
                setSendError(resolution.message);
                return;
            }
            if (resolution.mediaKind === "image") {
                await openImagePreview(resolution.file);
                return;
            }
            if (resolution.mediaKind === "video") {
                await openVideoPreview(resolution.file);
                return;
            }
            await handleSendDocument(resolution.file);
        } finally {
            setIsResolvingDroppedMedia(false);
        }
    }

    async function handleSendVideo(
        videoDataUrl: string,
        caption: string,
        options?: { viewOnce?: boolean; async?: boolean },
        bypassSendingGuard = false,
        existingPendingId?: string
    ) {
        const phone = getOutgoingPhone();
        if (!phone || (isSendingMedia && !bypassSendingGuard)) {
            if (existingPendingId) removePendingMessage(existingPendingId);
            return;
        }
        const estimatedSize = estimateDataUrlBytes(videoDataUrl);
        if (estimatedSize > MAX_VIDEO_BYTES) {
            setSendError(`Vídeo muito pesado (${formatBytes(estimatedSize)}). Limite: 16 MB.`);
            if (existingPendingId) removePendingMessage(existingPendingId);
            return;
        }
        const targetChatId = selectedChat?.id ?? selectedId;
        if (!targetChatId) {
            setSendError("Selecione uma conversa para enviar o vídeo.");
            if (existingPendingId) removePendingMessage(existingPendingId);
            return;
        }

        setSendError(null);
        if (!bypassSendingGuard) setIsSendingMedia(true);
        const pendingId =
            existingPendingId ??
            addPendingMediaMessage({
                chatId: targetChatId,
                type: "video",
                text: caption,
                mediaUrl: videoDataUrl,
            });
        updatePendingMessage(pendingId, { pendingLabel: "Enviando vídeo...", pendingProgress: existingPendingId ? 96 : 10 });

        try {
            const res = await fetch("/api/atendimentos/send-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone,
                    video: videoDataUrl,
                    caption: caption || undefined,
                    viewOnce: options?.viewOnce ?? false,
                    async: options?.async ?? false,
                }),
            });

            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { message?: string } | null;
                setSendError(data?.message ?? "Falha ao enviar vídeo");
                removePendingMessage(pendingId);
                return;
            }

            const data = (await res.json().catch(() => null)) as SendTextResult | null;
            removePendingMessage(pendingId);
            await loadConversations();
            if (data?.conversationId) {
                setSelectedId(data.conversationId);
                setMobileView("chat");
                await loadMessages(data.conversationId);
            } else if (selectedChat) {
                await loadMessages(selectedChat.id);
            }
            clearDraftForChat(targetChatId);
            if (data?.conversationId && data.conversationId !== targetChatId) {
                clearDraftForChat(data.conversationId);
            }
            if (!selectedChat) {
                setPendingPhone("");
                setNewChatNumber("");
            }
        } catch {
            removePendingMessage(pendingId);
            setSendError("Falha ao enviar vídeo");
        } finally {
            if (!bypassSendingGuard) setIsSendingMedia(false);
        }
    }

    function closeVideoPreview() {
        setIsVideoPreviewOpen(false);
        setVideoPreviewSource("");
        setVideoPreviewCaption("");
        setIsVideoPreviewPlaying(false);
        setVideoPreviewCurrentTime(0);
        setVideoPreviewDuration(0);
        setVideoPreviewMuted(false);
        setVideoEditorMode("draw");
        setVideoTextLayers([]);
        setSelectedVideoTextLayerId(null);
        setVideoEditorHistory([]);
        videoIsDrawingRef.current = false;
        videoLastDrawPointRef.current = null;
        videoTextDragRef.current = null;
        const overlay = videoOverlayCanvasRef.current;
        if (overlay) {
            const ctx = overlay.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
        }
    }

    function snapshotVideoOverlay() {
        const overlay = videoOverlayCanvasRef.current;
        if (!overlay || overlay.width === 0 || overlay.height === 0) return null;
        const ctx = overlay.getContext("2d");
        if (!ctx) return null;
        return overlay.toDataURL("image/png");
    }

    function restoreVideoOverlay(dataUrl: string | null) {
        const overlay = videoOverlayCanvasRef.current;
        if (!overlay) return;
        const ctx = overlay.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        if (!dataUrl) return;
        const image = new Image();
        image.onload = () => {
            const nextCtx = overlay.getContext("2d");
            if (!nextCtx) return;
            nextCtx.clearRect(0, 0, overlay.width, overlay.height);
            nextCtx.drawImage(image, 0, 0, overlay.width, overlay.height);
        };
        image.src = dataUrl;
    }

    function saveVideoEditorSnapshot() {
        const snapshot = {
            overlayData: snapshotVideoOverlay(),
            textLayers: videoTextLayers.map((layer) => ({ ...layer })),
        };
        setVideoEditorHistory((previous) => [...previous.slice(-24), snapshot]);
    }

    function undoVideoEditorChange() {
        setVideoEditorHistory((previous) => {
            if (!previous.length) return previous;
            const snapshot = previous[previous.length - 1];
            restoreVideoOverlay(snapshot.overlayData);
            setVideoTextLayers(snapshot.textLayers.map((layer) => ({ ...layer })));
            return previous.slice(0, -1);
        });
    }

    function videoOverlayHasContent(overlayData: string | null, textLayers: ImageTextLayer[]) {
        return Boolean(overlayData) || textLayers.some((layer) => layer.text.trim().length > 0);
    }

    function blobToDataUrl(blob: Blob) {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(new Error("Falha ao converter vídeo editado"));
            reader.readAsDataURL(blob);
        });
    }

    async function buildVideoPayloadSource(
        videoSource: string,
        overlayData: string | null,
        textLayers: ImageTextLayer[],
        onProgress?: (progress: number, label?: string) => void
    ) {
        if (!videoOverlayHasContent(overlayData, textLayers)) return videoSource;
        if (!videoSource) return videoSource;
        onProgress?.(2, "Preparando vídeo...");

        const sourceVideo = document.createElement("video");
        sourceVideo.src = videoSource;
        sourceVideo.muted = true;
        sourceVideo.playsInline = true;
        sourceVideo.preload = "auto";

        await new Promise<void>((resolve, reject) => {
            sourceVideo.onloadedmetadata = () => resolve();
            sourceVideo.onerror = () => reject(new Error("Falha ao preparar vídeo para edição"));
        });

        const width = Math.max(1, Math.floor(sourceVideo.videoWidth || 1));
        const height = Math.max(1, Math.floor(sourceVideo.videoHeight || 1));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return videoPreviewSource;

        const overlayImage = new Image();
        if (overlayData) {
            await new Promise<void>((resolve, reject) => {
                overlayImage.onload = () => resolve();
                overlayImage.onerror = () => reject(new Error("Falha ao carregar desenho do vídeo"));
                overlayImage.src = overlayData;
            });
        }

        const stream = canvas.captureStream(30);
        const mimeCandidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
        const mimeType = mimeCandidates.find((candidate) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate));
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) chunks.push(event.data);
        };

        const recordingStopped = new Promise<Blob>((resolve) => {
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
                resolve(blob);
            };
        });

        const drawFrame = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(sourceVideo, 0, 0, width, height);
            if (overlayData) {
                ctx.drawImage(overlayImage, 0, 0, width, height);
            }
            for (const layer of textLayers) {
                const value = layer.text.trim();
                if (!value) continue;
                const lines = value.split("\n");
                const lineHeight = Math.round(layer.fontSize * 1.15);
                ctx.save();
                ctx.translate(layer.x, layer.y);
                ctx.rotate((layer.rotation * Math.PI) / 180);
                ctx.font = `bold ${layer.fontSize}px sans-serif`;
                ctx.fillStyle = layer.color;
                ctx.strokeStyle = "rgba(0,0,0,0.45)";
                ctx.lineWidth = 2;
                lines.forEach((line, index) => {
                    const y = layer.fontSize + index * lineHeight;
                    ctx.strokeText(line, 0, y, layer.boxWidth);
                    ctx.fillText(line, 0, y, layer.boxWidth);
                });
                ctx.restore();
            }
        };

        recorder.start(100);
        await sourceVideo.play();

        await new Promise<void>((resolve) => {
            const tick = () => {
                drawFrame();
                const duration = sourceVideo.duration || 0;
                const current = sourceVideo.currentTime || 0;
                const ratio = duration > 0 ? current / duration : 0;
                onProgress?.(Math.max(5, Math.min(92, Math.floor(ratio * 90))), "Processando vídeo...");
                if (sourceVideo.ended || sourceVideo.paused) {
                    resolve();
                    return;
                }
                requestAnimationFrame(tick);
            };
            sourceVideo.onended = () => resolve();
            requestAnimationFrame(tick);
        });

        if (recorder.state !== "inactive") recorder.stop();
        onProgress?.(96, "Enviando vídeo...");
        const renderedBlob = await recordingStopped;
        return blobToDataUrl(renderedBlob);
    }

    async function confirmVideoSendFromPreview() {
        if (!videoPreviewSource) return;
        if (isSendingMedia) return;

        const source = videoPreviewSource;
        const caption = videoPreviewCaption.trim();
        const overlayData = snapshotVideoOverlay();
        const textLayersSnapshot = videoTextLayers.map((layer) => ({ ...layer }));
        const targetChatId = selectedChat?.id ?? selectedId;
        if (!targetChatId) return;

        const pendingId = addPendingMediaMessage({
            chatId: targetChatId,
            type: "video",
            text: caption,
            mediaUrl: source,
        });

        closeVideoPreview();
        setIsSendingMedia(true);

        void (async () => {
            try {
                const payloadVideo = await buildVideoPayloadSource(source, overlayData, textLayersSnapshot, (progress, label) => {
                    updatePendingMessage(pendingId, {
                        pendingProgress: progress,
                        pendingLabel: label ?? "Processando vídeo...",
                    });
                });
                await handleSendVideo(
                    payloadVideo,
                    caption,
                    {
                        viewOnce: false,
                        async: false,
                    },
                    true,
                    pendingId
                );
            } catch {
                removePendingMessage(pendingId);
                setSendError("Falha ao processar vídeo editado");
            } finally {
                setIsSendingMedia(false);
            }
        })();
    }

    function getVideoOverlayPoint(clientX: number, clientY: number) {
        const canvas = videoOverlayCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: clamp((clientX - rect.left) * scaleX, 0, canvas.width),
            y: clamp((clientY - rect.top) * scaleY, 0, canvas.height),
        };
    }

    function addVideoTextLayer() {
        const canvas = videoOverlayCanvasRef.current;
        if (!canvas) return;
        saveVideoEditorSnapshot();
        const id = `video-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const layer: ImageTextLayer = {
            id,
            text: "Digite aqui",
            x: Math.max(12, Math.round(canvas.width * 0.2)),
            y: Math.max(12, Math.round(canvas.height * 0.2)),
            color: imageDrawColor,
            fontSize: 26,
            boxWidth: 220,
            rotation: 0,
        };
        setVideoTextLayers((previous) => [...previous, layer]);
        setSelectedVideoTextLayerId(id);
        setVideoEditorMode("text");
    }

    function updateVideoTextLayer(id: string, updater: (layer: ImageTextLayer) => ImageTextLayer) {
        setVideoTextLayers((previous) => previous.map((layer) => (layer.id === id ? updater(layer) : layer)));
    }

    function handleVideoOverlayPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
        const point = getVideoOverlayPoint(event.clientX, event.clientY);
        const canvas = videoOverlayCanvasRef.current;
        if (!point || !canvas) return;
        if (videoEditorMode !== "draw") return;
        saveVideoEditorSnapshot();
        videoIsDrawingRef.current = true;
        videoLastDrawPointRef.current = point;
    }

    function handleVideoOverlayPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
        const point = getVideoOverlayPoint(event.clientX, event.clientY);
        const canvas = videoOverlayCanvasRef.current;
        if (!point || !canvas) return;
        if (!videoIsDrawingRef.current || videoEditorMode !== "draw") return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const previous = videoLastDrawPointRef.current;
        if (!previous) {
            videoLastDrawPointRef.current = point;
            return;
        }
        ctx.strokeStyle = imageDrawColor;
        ctx.lineWidth = imageDrawSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        videoLastDrawPointRef.current = point;
    }

    function stopVideoDrawing() {
        videoIsDrawingRef.current = false;
        videoLastDrawPointRef.current = null;
    }

    function handleVideoTextDragStart(layerId: string, event: React.PointerEvent<HTMLButtonElement>) {
        const point = getVideoOverlayPoint(event.clientX, event.clientY);
        const target = videoTextLayers.find((layer) => layer.id === layerId);
        if (!point || !target) return;
        saveVideoEditorSnapshot();
        event.preventDefault();
        event.stopPropagation();
        setSelectedVideoTextLayerId(layerId);
        videoTextDragRef.current = {
            id: layerId,
            offsetX: point.x - target.x,
            offsetY: point.y - target.y,
        };
    }

    function handleVideoStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const drag = videoTextDragRef.current;
        if (!drag) return;
        const point = getVideoOverlayPoint(event.clientX, event.clientY);
        const canvas = videoOverlayCanvasRef.current;
        const target = videoTextLayers.find((layer) => layer.id === drag.id);
        if (!point || !canvas || !target) return;
        const x = clamp(point.x - drag.offsetX, 0, Math.max(0, canvas.width - target.boxWidth));
        const y = clamp(point.y - drag.offsetY, 0, Math.max(0, canvas.height - target.fontSize));
        updateVideoTextLayer(drag.id, (layer) => ({ ...layer, x, y }));
    }

    function stopVideoTextDrag() {
        videoTextDragRef.current = null;
    }

    async function openVideoPreview(file: File) {
        setSendError(null);
        if (!isVideoFile(file)) {
            setSendError("Selecione um arquivo de vídeo válido.");
            return;
        }
        if (file.size > MAX_VIDEO_BYTES) {
            setSendError(`Vídeo muito pesado (${formatBytes(file.size)}). Limite: 16 MB.`);
            return;
        }

        const phone = getOutgoingPhone();
        if (!phone || isSendingMedia) return;

        setSendError(null);
        setIsAttachmentMenuOpen(false);
        try {
            const video = await readFileAsDataUrl(file);
            setVideoPreviewSource(video);
            setVideoPreviewCaption(selectedChatDraftTrimmed);
            setIsVideoPreviewPlaying(false);
            setVideoPreviewCurrentTime(0);
            setVideoPreviewDuration(0);
            setVideoPreviewMuted(false);
            setVideoEditorMode("draw");
            setVideoTextLayers([]);
            setSelectedVideoTextLayerId(null);
            setVideoEditorHistory([]);
            setIsVideoPreviewOpen(true);
        } catch (error) {
            setSendError(error instanceof Error ? error.message : "Não foi possível abrir o vídeo para envio.");
        }
    }

    function handleImageInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        void openImagePreview(file);
    }

    function handleVideoInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        void openVideoPreview(file);
    }

    function handleDocumentInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        void handleSendDocument(file);
    }

    function openGalleryPicker() {
        setIsAttachmentMenuOpen(false);
        galleryInputRef.current?.click();
    }

    function openVideoPicker() {
        setIsAttachmentMenuOpen(false);
        videoInputRef.current?.click();
    }

    function openDocumentPicker() {
        setIsAttachmentMenuOpen(false);
        documentInputRef.current?.click();
    }

    useEffect(() => {
        if (!isImagePreviewOpen || !imagePreviewSource) return;
        const canvas = imageEditorCanvasRef.current;
        if (!canvas) return;

        const image = new Image();
        image.onload = () => {
            const maxWidth = 920;
            const maxHeight = 680;
            const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
            const width = Math.max(1, Math.round(image.width * ratio));
            const height = Math.max(1, Math.round(image.height * ratio));
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(image, 0, 0, width, height);
            imageEditorBaseImageRef.current = image;
        };
        image.src = imagePreviewSource;
    }, [isImagePreviewOpen, imagePreviewSource]);

    useEffect(() => {
        if (!selectedTextLayerId) return;
        const exists = imageTextLayers.some((layer) => layer.id === selectedTextLayerId);
        if (!exists) setSelectedTextLayerId(null);
    }, [imageTextLayers, selectedTextLayerId]);

    useEffect(() => {
        if (!selectedVideoTextLayerId) return;
        const exists = videoTextLayers.some((layer) => layer.id === selectedVideoTextLayerId);
        if (!exists) setSelectedVideoTextLayerId(null);
    }, [videoTextLayers, selectedVideoTextLayerId]);

    useEffect(() => {
        if (!isVideoPreviewOpen) return;
        const video = videoPreviewRef.current;
        if (!video) return;
        video.muted = videoPreviewMuted;
    }, [isVideoPreviewOpen, videoPreviewMuted]);

    function renderContactSidebar() {
        if (!selectedChat || !isContactSidebarVisible) return null;

        return (
            <div
                className={`pointer-events-auto flex h-full min-h-0 w-full max-w-[380px] flex-col border-l border-black/10 bg-white shadow-2xl transition-all duration-[220ms] ease-out lg:w-[360px] lg:max-w-[360px] ${
                    isContactSidebarActive ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
                }`}
            >
                <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-io-dark">Dados do contato</p>
                        <p className="text-xs text-black/50">
                            {contactSidebarTab === "details"
                                ? "Informações e edição do contato"
                                : `${selectedChatMediaItems.length} ${selectedChatMediaItems.length === 1 ? "mídia" : "mídias"} na conversa`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {contactSidebarTab === "details" ? (
                            isContactSidebarEditing ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={cancelContactSidebarEditing}
                                        className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold text-black/70 transition hover:bg-black/5"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={saveContactSidebarChanges}
                                        className="rounded-lg bg-io-purple px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                                    >
                                        Salvar
                                    </button>
                                </>
                            ) : (
                                <>
                                    {isCurrentUserSuperAdmin ? (
                                        <button
                                            type="button"
                                            onClick={openDeleteConversationModal}
                                            disabled={isDeletingContactConversation}
                                            className={`grid h-9 w-9 place-items-center rounded-lg border transition ${
                                                isDeletingContactConversation
                                                    ? "cursor-not-allowed border-red-200 text-red-300 opacity-70"
                                                    : "border-red-200 text-red-600 hover:bg-red-50"
                                            }`}
                                            aria-label="Excluir conversa"
                                            title="Excluir conversa"
                                        >
                                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={startContactSidebarEditing}
                                        disabled={isDeletingContactConversation}
                                        className={`grid h-9 w-9 place-items-center rounded-lg border border-black/10 text-black/65 transition ${
                                            isDeletingContactConversation ? "cursor-not-allowed opacity-60" : "hover:bg-black/5"
                                        }`}
                                        aria-label="Editar contato"
                                        title="Editar contato"
                                    >
                                        <Pencil className="h-4 w-4" strokeWidth={2} />
                                    </button>
                                </>
                            )
                        ) : null}
                        <button
                            type="button"
                            onClick={closeContactSidebar}
                            className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 text-black/65 transition hover:bg-black/5"
                            aria-label="Fechar dados do contato"
                            title="Fechar"
                        >
                            <X className="h-4 w-4" strokeWidth={2} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-1 border-b border-black/10 p-2">
                    <button
                        type="button"
                        onClick={() => {
                            setContactSidebarTab("details");
                            setContactSidebarMsg(null);
                        }}
                        className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${contactSidebarTab === "details" ? "bg-violet-600 text-white" : "text-black/65 hover:bg-black/5"}`}
                    >
                        Dados
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setContactSidebarTab("media");
                            setIsContactSidebarEditing(false);
                            setContactSidebarMsg(null);
                        }}
                        className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${contactSidebarTab === "media" ? "bg-violet-600 text-white" : "text-black/65 hover:bg-black/5"}`}
                    >
                        Mídias
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    {contactSidebarMsg ? (
                        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                            {contactSidebarMsg}
                        </div>
                    ) : null}

                    {contactSidebarTab === "details" ? (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3">
                                {selectedChat.photoUrl ? (
                                    <img src={selectedChat.photoUrl} alt={selectedChat.name} className="h-16 w-16 rounded-full object-cover" />
                                ) : (
                                    <div className="grid h-16 w-16 place-items-center rounded-full bg-io-purple/10 text-lg font-semibold text-io-purple">
                                        {toInitials(isContactSidebarEditing ? contactSidebarDraft.name || selectedChat.name : selectedChat.name)}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">Contato</p>
                                    {isContactSidebarEditing ? (
                                        <input
                                            value={contactSidebarDraft.name}
                                            onChange={(event) => {
                                                setContactSidebarDraft((previous) => ({ ...previous, name: event.target.value }));
                                                setContactSidebarMsg(null);
                                            }}
                                            placeholder="Nome do contato"
                                            className="h-11 w-full rounded-xl border border-black/15 px-3 text-sm text-io-dark outline-none transition focus:border-io-purple"
                                        />
                                    ) : (
                                        <p className="truncate text-lg font-semibold text-io-dark">{selectedChat.name}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">Telefone</p>
                                {isContactSidebarEditing ? (
                                    <input
                                        value={contactSidebarDraft.phone}
                                        onChange={(event) => {
                                            setContactSidebarDraft((previous) => ({ ...previous, phone: event.target.value }));
                                            setContactSidebarMsg(null);
                                        }}
                                        placeholder="Telefone do contato"
                                        className="h-11 w-full rounded-xl border border-black/15 px-3 text-sm text-io-dark outline-none transition focus:border-io-purple"
                                    />
                                ) : (
                                    <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-io-dark">
                                        {formatContactPhone(selectedChat.displayPhone || selectedChat.phone)}
                                    </div>
                                )}
                            </div>

                            <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">Etiquetas</p>
                                {isContactSidebarEditing ? (
                                    availableLabels.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-black/15 px-4 py-3 text-sm text-black/50">
                                            Nenhuma etiqueta cadastrada em Configurações.
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {availableLabels.map((label) => {
                                                const active = contactSidebarDraft.labelIds.includes(label.id);
                                                return (
                                                    <button
                                                        key={label.id}
                                                        type="button"
                                                        onClick={() => {
                                                            toggleContactSidebarDraftLabel(label.id);
                                                            setContactSidebarMsg(null);
                                                        }}
                                                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${active ? "border-violet-600 bg-violet-50 text-violet-700" : "border-black/10 text-black/65 hover:bg-black/5"}`}
                                                    >
                                                        {label.title}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )
                                ) : (
                                    <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3">
                                        {selectedChatLabels.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {selectedChatLabels.map((label) => (
                                                    <LabelBadge key={label.id} label={label} />
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-black/55">Nenhuma etiqueta cadastrada.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">Descrição</p>
                                {isContactSidebarEditing ? (
                                    <textarea
                                        value={contactSidebarDraft.description}
                                        onChange={(event) => {
                                            setContactSidebarDraft((previous) => ({ ...previous, description: event.target.value }));
                                            setContactSidebarMsg(null);
                                        }}
                                        rows={6}
                                        placeholder="Adicione uma descrição para este contato"
                                        className="w-full rounded-2xl border border-black/15 px-3 py-3 text-sm text-io-dark outline-none transition focus:border-io-purple"
                                    />
                                ) : (
                                    <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm leading-6 text-io-dark">
                                        {selectedChatDescription || "Nenhuma descrição cadastrada."}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : selectedChatMediaItems.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-black/15 px-4 py-6 text-center text-sm text-black/50">
                            Nenhum anexo encontrado nesta conversa.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {selectedChatMediaItems.map((item) => (
                                <article key={item.id} className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                                    <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="rounded-full bg-black/5 px-2 py-1 text-[11px] font-semibold text-black/60">
                                                {item.type === "image" ? "Imagem" : item.type === "sticker" ? "Figurinha" : item.type === "video" ? "Vídeo" : item.type === "document" ? "Documento" : "Áudio"}
                                            </span>
                                            <span className="truncate text-xs text-black/45">
                                                {item.message.fromMe ? "Enviado por você" : "Enviado pelo contato"}
                                            </span>
                                        </div>
                                        <span className="text-[11px] font-medium text-black/45">{formatDateTime(item.atRaw)}</span>
                                    </div>

                                    <div className="space-y-3 p-4">
                                        {item.type === "image" ? (
                                            <button
                                                type="button"
                                                onClick={() => openMediaViewer(item.message, "image", item.source)}
                                                className="block w-full overflow-hidden rounded-2xl bg-[#f7f5fb]"
                                            >
                                                <img src={item.source} alt="Imagem da conversa" className="max-h-64 w-full object-contain" />
                                            </button>
                                        ) : item.type === "sticker" ? (
                                            <button
                                                type="button"
                                                onClick={() => openMediaViewer(item.message, "image", item.source)}
                                                className="block rounded-2xl bg-[#f7f5fb] p-3"
                                            >
                                                <img src={item.source} alt="Figurinha da conversa" className="max-h-40 w-auto max-w-[180px] object-contain" />
                                            </button>
                                        ) : item.type === "video" ? (
                                            <button
                                                type="button"
                                                onClick={() => openMediaViewer(item.message, "video", item.source)}
                                                className="relative block w-full overflow-hidden rounded-2xl bg-io-purple"
                                            >
                                                <video src={item.source} className="max-h-64 w-full object-contain opacity-90" muted />
                                                <span className="pointer-events-none absolute inset-0 grid place-items-center">
                                                    <span className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white">
                                                        <Play className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                                                    </span>
                                                </span>
                                            </button>
                                        ) : item.type === "document" ? (
                                            <button
                                                type="button"
                                                onClick={() => void handleDownloadDocument(item.source, item.message.documentName)}
                                                className="flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 text-left transition hover:bg-black/5"
                                            >
                                                <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-violet-100 text-violet-700">
                                                    <FileText className="h-5 w-5" strokeWidth={1.8} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold text-io-dark">
                                                        {item.message.documentName || (item.text && item.text !== "[Documento]" ? item.text : "Documento")}
                                                    </span>
                                                    <span className="block text-xs text-black/50">Toque para baixar</span>
                                                </span>
                                            </button>
                                        ) : (
                                            <audio controls preload="metadata" className="w-full" src={item.source} />
                                        )}

                                        {item.text && !["[Imagem]", "[Vídeo]", "[Áudio]", "[Audio]", "[Documento]"].includes(item.text) && item.text !== item.message.documentName ? (
                                            <MessageText
                                                text={item.text}
                                                className="text-sm leading-6 text-io-dark whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                                                linkClassName="font-medium text-io-purple underline decoration-io-purple/45 underline-offset-2"
                                            />
                                        ) : null}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden bg-white lg:grid-cols-[430px_minmax(0,1fr)]">
                <section className={`${mobileView === "chat" ? "hidden lg:flex" : "flex"} min-h-0 flex-col overflow-hidden border-r border-black/10 bg-white`}>
                    <header className="border-b border-black/10 px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("new")}
                                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === "new" ? "bg-violet-600 text-white" : "bg-black/5 text-io-dark"}`}
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        <span>Novos</span>
                                        {(newUnreadCount > 0 || newChatsCount > 0) && (
                                            <span className="grid h-5 w-5 place-items-center rounded-full bg-red-600 text-[11px] leading-none text-white">
                                                {(newUnreadCount > 0 ? newUnreadCount : newChatsCount) > 9 ? "9+" : (newUnreadCount > 0 ? newUnreadCount : newChatsCount)}
                                            </span>
                                        )}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("mine")}
                                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === "mine" ? "bg-violet-600 text-white" : "bg-black/5 text-io-dark"}`}
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        <span>Meus</span>
                                        {mineUnreadCount > 0 && (
                                            <span className="grid h-5 w-5 place-items-center rounded-full bg-red-600 text-[11px] leading-none text-white">
                                                {mineUnreadCount > 9 ? "9+" : mineUnreadCount}
                                            </span>
                                        )}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("all")}
                                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === "all" ? "bg-violet-600 text-white" : "bg-black/5 text-io-dark"}`}
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        <span>Geral</span>
                                        {allUnreadCount > 0 && (
                                            <span className="grid h-5 w-5 place-items-center rounded-full bg-red-600 text-[11px] leading-none text-white">
                                                {allUnreadCount > 9 ? "9+" : allUnreadCount}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </div>
                            <div className="flex items-center gap-1.5 text-black/70">
                                <button
                                    type="button"
                                    onClick={() => setShowConcludedOnly((value) => !value)}
                                    className={`rounded-md p-1.5 transition hover:bg-black/5 ${showConcludedOnly ? "bg-violet-100 text-violet-700" : ""}`}
                                    aria-label="Concluídos"
                                    title="Mostrar atendimentos concluídos"
                                >
                                    <Archive className="h-4 w-4" strokeWidth={2} />
                                </button>
                                <div ref={advancedFiltersRef} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAdvancedFiltersOpen((open) => !open);
                                            setIsSortMenuOpen(false);
                                        }}
                                        className={`rounded-md p-1.5 transition hover:bg-black/5 ${(selectedAssignedUserIds.length > 0 || selectedTeamNames.length > 0 || selectedFilterLabelIds.length > 0) ? "bg-violet-100 text-violet-700" : ""}`}
                                        aria-label="Filtros"
                                        title="Filtrar por usuário, equipe e etiquetas"
                                    >
                                        <Filter className="h-4 w-4" strokeWidth={2} />
                                    </button>
                                    {isAdvancedFiltersOpen && (
                                        <div className="absolute right-0 top-9 z-30 w-80 rounded-xl border border-black/10 bg-white p-3 shadow-lg">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-xs font-semibold text-io-dark">Filtros</p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedAssignedUserIds([]);
                                                        setSelectedTeamNames([]);
                                                        setSelectedFilterLabelIds([]);
                                                    }}
                                                    className="text-[11px] font-semibold text-violet-700 hover:underline"
                                                >
                                                    Limpar
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                <CompactMultiSelect
                                                    title="Usuário"
                                                    placeholder="Adicionar usuários"
                                                    selectedValues={selectedAssignedUserIds}
                                                    options={userFilterSelectOptions}
                                                    emptyOptionsMessage="Nenhum usuário encontrado."
                                                    emptySelectionMessage="Nenhum usuário selecionado."
                                                    onChange={setSelectedAssignedUserIds}
                                                />
                                                <CompactMultiSelect
                                                    title="Equipe"
                                                    placeholder="Adicionar equipes"
                                                    selectedValues={selectedTeamNames}
                                                    options={teamFilterSelectOptions}
                                                    emptyOptionsMessage="Nenhuma equipe encontrada."
                                                    emptySelectionMessage="Nenhuma equipe selecionada."
                                                    onChange={setSelectedTeamNames}
                                                />
                                                <CompactMultiSelect
                                                    title="Etiquetas"
                                                    placeholder="Adicionar etiquetas"
                                                    selectedValues={selectedFilterLabelIds}
                                                    options={labelFilterSelectOptions}
                                                    emptyOptionsMessage="Nenhuma etiqueta cadastrada."
                                                    emptySelectionMessage="Nenhuma etiqueta selecionada."
                                                    onChange={setSelectedFilterLabelIds}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div ref={sortMenuRef} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSortMenuOpen((open) => !open);
                                            setIsAdvancedFiltersOpen(false);
                                        }}
                                        className={`rounded-md p-1.5 transition hover:bg-black/5 ${sortOrder === "oldest_first" ? "bg-violet-100 text-violet-700" : ""}`}
                                        aria-label="Ordenar"
                                        title="Ordenar lista"
                                    >
                                        <ArrowUpDown className="h-4 w-4" strokeWidth={2} />
                                    </button>
                                    {isSortMenuOpen && (
                                        <div className="absolute right-0 top-9 z-30 w-56 rounded-xl border border-black/10 bg-white p-1 shadow-lg">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSortOrder("recent_first");
                                                    setIsSortMenuOpen(false);
                                                }}
                                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${sortOrder === "recent_first" ? "bg-violet-50 text-violet-700" : "hover:bg-black/5"}`}
                                            >
                                                <span>Últimas interações primeiro</span>
                                                {sortOrder === "recent_first" ? "✓" : ""}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSortOrder("oldest_first");
                                                    setIsSortMenuOpen(false);
                                                }}
                                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${sortOrder === "oldest_first" ? "bg-violet-50 text-violet-700" : "hover:bg-black/5"}`}
                                            >
                                                <span>Mais antigos primeiro</span>
                                                {sortOrder === "oldest_first" ? "✓" : ""}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowUnreadOnly((value) => !value)}
                                    className={`rounded-md p-1.5 transition hover:bg-black/5 ${showUnreadOnly ? "bg-violet-100 text-violet-700" : ""}`}
                                    aria-label="Apenas não lidas"
                                    title="Mostrar apenas contatos com mensagens não lidas"
                                >
                                    <Rows3 className="h-4 w-4" strokeWidth={2} />
                                </button>
                            </div>
                        </div>
                        <div className="mt-3">
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Buscar atendimento"
                                className="h-10 w-full rounded-xl border border-black/10 bg-black/5 px-3 text-sm text-io-dark placeholder:text-black/40 outline-none transition focus:border-violet-500"
                            />
                        </div>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {filteredChats.map((chat) => {
                            const active = chat.id === selectedChat?.id;
                            const lastMessageTypeLabel = getMessageTypeLabel(chat.lastMessageType, chat.lastMessage);
                            const draftPreview = getDraftPreview(draftsByChatId[chat.id] ?? "");
                            const hasDraftPreview = draftPreview.length > 0;
                            const chatLabels = labelsByContactKey[normalizePhone(chat.phone)] ?? [];
                            return (
                                <button
                                    key={chat.id}
                                    type="button"
                                    onClick={() => handleSelectChat(chat.id)}
                                    className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-black/5 px-3 py-3 text-left transition hover:bg-black/5 ${
                                        active ? "bg-io-light/60" : ""
                                    }`}
                                >
                                    {chat.photoUrl ? (
                                        <img src={chat.photoUrl} alt={chat.name} loading="eager" decoding="sync" className="h-11 w-11 rounded-full object-cover" />
                                    ) : (
                                        <div className="grid h-11 w-11 place-items-center rounded-full bg-io-purple text-xs font-semibold text-white">
                                            {chat.avatar}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="truncate text-base font-semibold text-io-dark">{chat.name}</p>
                                        {chatLabels.length > 0 && (
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {chatLabels.map((label) => (
                                                    <LabelBadge key={label.id} label={label} />
                                                ))}
                                            </div>
                                        )}
                                        {hasDraftPreview ? (
                                            <p className="truncate text-sm text-amber-700">
                                                <span className="font-semibold">Rascunho:</span> {draftPreview}
                                            </p>
                                        ) : isComposingPresence(chat.presenceStatus) ? (
                                            <p className="truncate text-sm font-medium text-green-600">Digitando...</p>
                                        ) : (
                                            <div className="flex items-center gap-1 truncate text-sm text-black/65">
                                                {chat.lastMessageFromMe ? <MessageStatusCheck status={toOutgoingMessageStatus(chat.lastMessageStatus)} tone="list" /> : null}
                                                {lastMessageTypeLabel ? (
                                                    <>
                                                        <MessageTypeListIcon type={chat.lastMessageType} />
                                                        <p className="truncate">{lastMessageTypeLabel}</p>
                                                    </>
                                                ) : (
                                                    <p className="truncate">{chat.lastMessage}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid min-h-[44px] grid-rows-[auto_1fr_auto] justify-items-end">
                                        <span className="text-[11px] text-black/55">{chat.lastAt}</span>
                                        {(unreadByChatId[chat.id] ?? 0) > 0 && (
                                            <span className="grid h-5 w-5 place-items-center rounded-full bg-red-600 text-[11px] leading-none text-white">
                                                {(unreadByChatId[chat.id] ?? 0) > 9 ? "9+" : (unreadByChatId[chat.id] ?? 0)}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <footer className="border-t border-black/10 bg-white p-3">
                        <div className="grid grid-cols-[90px_minmax(0,1fr)_110px] gap-2">
                            <div ref={ddiDropdownRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsDdiOpen((open) => !open)}
                                    className="flex h-10 w-full items-center justify-between rounded-xl border border-black/10 bg-black/5 px-2 text-sm text-io-dark"
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        {selectedDdi && (
                                            <img src={selectedDdi.flagUrl} alt={selectedDdi.iso} className="h-3.5 w-5 rounded-[2px] object-cover" />
                                        )}
                                        <span>{selectedDdi ? selectedDdi.ddi : `+${getCountryCallingCode(countryIso)}`}</span>
                                    </span>
                                    <ChevronDown
                                        className={`h-4 w-4 text-black/60 transition-transform ${isDdiOpen ? "rotate-180" : ""}`}
                                        strokeWidth={2}
                                        aria-hidden="true"
                                    />
                                </button>
                                {isDdiOpen && (
                                    <div className="absolute bottom-12 left-0 z-20 max-h-72 w-72 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
                                        <div className="border-b border-black/10 p-2">
                                            <input
                                                value={ddiQuery}
                                                onChange={(event) => setDdiQuery(event.target.value)}
                                                placeholder="Buscar país ou DDI"
                                                className="h-9 w-full rounded-lg border border-black/10 px-2 text-sm outline-none"
                                            />
                                        </div>
                                        <div className="max-h-56 overflow-y-auto">
                                            {filteredDdiOptions.map((option) => (
                                                <button
                                                    key={option.iso}
                                                    type="button"
                                                    onClick={() => {
                                                        setCountryIso(option.iso);
                                                        setIsDdiOpen(false);
                                                        setDdiQuery("");
                                                    }}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5"
                                                >
                                                    <img src={option.flagUrl} alt={option.iso} className="h-3.5 w-5 rounded-[2px] object-cover" />
                                                    <span className="min-w-10 text-black/75">{option.ddi}</span>
                                                    <span className="truncate text-black/80">{option.country}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <input
                                value={displayedLocalNumber}
                                onChange={(event) => handleLocalNumberInput(event.target.value)}
                                placeholder="DDD + Número"
                                className="h-10 rounded-xl border border-black/10 bg-black/5 px-3 text-sm text-io-dark placeholder:text-black/40 outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleStartConversation}
                                className="h-10 rounded-xl bg-violet-600 text-sm font-semibold text-white transition hover:brightness-110"
                            >
                                Conversar
                            </button>
                        </div>
                    </footer>
                </section>

                <section
                    className={`${mobileView === "list" ? "hidden lg:flex" : "flex"} relative min-h-0 min-w-0 flex-col overflow-hidden`}
                    onDragEnterCapture={handleChatDragEnter}
                    onDragOverCapture={handleChatDragOver}
                    onDragLeaveCapture={handleChatDragLeave}
                    onDropCapture={handleChatDrop}
                >
                    {selectedChat ? (
                        <>
                            <header className="flex items-center gap-3 border-b border-black/10 px-4 py-3">
                                <button
                                    type="button"
                                    onClick={() => setMobileView("list")}
                                    className="rounded-lg px-2 py-1 text-sm text-io-purple lg:hidden"
                                >
                                    Voltar
                                </button>
                                <button
                                    type="button"
                                    onClick={openContactSidebar}
                                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-black/5"
                                    aria-label="Abrir dados do contato"
                                    title="Abrir dados do contato"
                                >
                                    {selectedChat.photoUrl ? (
                                        <img src={selectedChat.photoUrl} alt={selectedChat.name} loading="eager" decoding="sync" className="h-10 w-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="grid h-10 w-10 place-items-center rounded-full bg-io-purple text-xs font-semibold text-white">
                                            {selectedChat.avatar}
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-io-dark">{selectedChat.name}</p>
                                        {selectedChatLabels.length > 0 && (
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {selectedChatLabels.map((label) => (
                                                    <LabelBadge key={label.id} label={label} />
                                                ))}
                                            </div>
                                        )}
                                        {getPresenceLabel(selectedChat.presenceStatus) ? (
                                            <p className={`flex items-center gap-1 text-xs ${isComposingPresence(selectedChat.presenceStatus) ? "text-green-600" : "text-black/55"}`}>
                                                {isAvailablePresence(selectedChat.presenceStatus) && (
                                                    <span className="h-2 w-2 rounded-full bg-green-500" />
                                                )}
                                                {getPresenceLabel(selectedChat.presenceStatus)}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-black/45">Toque para ver dados do contato</p>
                                        )}
                                    </div>
                                </button>
                                <div className="ml-auto flex items-center gap-2">
                                    <div ref={chatLabelsDropdownRef} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setIsChatLabelsOpen((open) => !open)}
                                            className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 text-black/65 transition hover:bg-black/5"
                                            aria-label="Aplicar etiqueta"
                                            title="Etiquetas"
                                        >
                                            <Tag className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                        {isChatLabelsOpen && (
                                            <div className="absolute right-0 top-11 z-30 w-64 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
                                                <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
                                                    <p className="text-xs font-semibold text-io-dark">Etiquetas</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsChatLabelsOpen(false);
                                                            router.push("/protected/configuracoes");
                                                        }}
                                                        className="grid h-6 w-6 place-items-center rounded-md border border-black/10 text-black/70 transition hover:bg-black/5"
                                                        aria-label="Gerenciar etiquetas"
                                                        title="Gerenciar etiquetas"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                                                    </button>
                                                </div>
                                                <div className="max-h-64 overflow-y-auto p-1">
                                                    {availableLabels.length === 0 ? (
                                                        <p className="px-2 py-3 text-xs text-black/55">Nenhuma etiqueta cadastrada em Configurações.</p>
                                                    ) : (
                                                        availableLabels.map((label) => {
                                                            const active = selectedChatLabelIds.includes(label.id);
                                                            return (
                                                                <button
                                                                    key={label.id}
                                                                    type="button"
                                                                    onClick={() => toggleLabelOnSelectedChat(label.id)}
                                                                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm ${active ? "bg-violet-50" : "hover:bg-black/5"}`}
                                                                >
                                                                    <LabelBadge label={label} />
                                                                    {active ? (
                                                                        <Check className="h-4 w-4 text-violet-600" strokeWidth={2} />
                                                                    ) : null}
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleOpenTransfer}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold text-io-dark transition hover:bg-black/5"
                                        aria-label="Transferir atendimento"
                                        title="Transferir atendimento"
                                    >
                                        <Move className="h-4 w-4" strokeWidth={2} />
                                        <span>Transferir</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={openConcludeModal}
                                        className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                    >
                                        Concluir
                                    </button>
                                </div>
                            </header>

                            <div className="relative min-h-0 flex-1 overflow-hidden">
                                {(isMessageDropActive || isResolvingDroppedMedia) && (
                                    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-io-purple/10 px-6">
                                        <div className="rounded-2xl border border-dashed border-io-purple/45 bg-white px-6 py-4 text-center shadow-lg">
                                            <p className="text-sm font-semibold text-io-dark">
                                                {isResolvingDroppedMedia ? "Preparando arquivo..." : "Solte a imagem, vídeo ou documento"}
                                            </p>
                                            <p className="mt-1 text-xs text-black/55">
                                                {isResolvingDroppedMedia
                                                    ? "Estamos preparando o arquivo para abrir no editor ou enviar na conversa."
                                                    : "Imagens abrem no editor; vídeos abrem no preview; documentos são enviados direto na conversa."}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex h-full min-w-0">
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                        <div ref={messagesContainerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f7f5fb] px-4 py-4">
                                {selectedChatConclusion && hasOlderHistoryInSelectedChat && !showSelectedChatHistory && (
                                    <div className="flex items-center justify-center">
                                        <button
                                            type="button"
                                            onClick={() => setShowSelectedChatHistory(true)}
                                            className="rounded-full border border-io-purple/30 bg-white px-4 py-1 text-xs font-semibold text-io-purple hover:bg-io-purple/5"
                                        >
                                            Ver histórico de atendimentos
                                        </button>
                                    </div>
                                )}
                                {timelineEntries.map((entry) => {
                                    if (entry.kind === "date") {
                                        return (
                                            <div key={entry.id} className="flex items-center justify-center">
                                                <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-medium text-black/55">
                                                    {entry.label}
                                                </div>
                                            </div>
                                        );
                                    }
                                    if (entry.kind === "notice") {
                                        return (
                                            <div key={entry.id} className="flex items-center gap-3 py-1">
                                                <div className="h-px flex-1 bg-black/10" />
                                                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] text-black/65">
                                                    <ArrowRight className="h-3.5 w-3.5 text-io-purple" strokeWidth={2} />
                                                    <span>{entry.notice.text}</span>
                                                    <span className="font-semibold text-black/70">{formatDateTime(entry.notice.atRaw)}</span>
                                                </div>
                                                <div className="h-px flex-1 bg-black/10" />
                                            </div>
                                        );
                                    }
                                    const message = entry.message;
                                    const resolvedMediaType = getResolvedMessageMediaType(message);
                                    const invalidMessageNotice = resolvedMediaType ? null : getInvalidMessageNotice(message.type, message.text);
                                    const isInvalidBubble = Boolean(invalidMessageNotice);
                                    const invalidMessageTypeDetail = isInvalidBubble ? getInvalidMessageTypeDetail(message.type) : "";
                                    const isAudioBubble = !isInvalidBubble && resolvedMediaType === "audio";
                                    const isStickerBubble = !isInvalidBubble && resolvedMediaType === "sticker";
                                    const linkToneClass = message.fromMe
                                        ? "font-medium underline decoration-white/70 underline-offset-2"
                                        : "font-medium text-io-purple underline decoration-io-purple/45 underline-offset-2";
                                    const bubbleClass = isInvalidBubble
                                        ? `max-w-[82%] md:max-w-[62%] overflow-hidden rounded-2xl border border-dashed px-3 py-2 text-sm shadow-sm ${
                                            message.fromMe
                                                ? "rounded-br-md border-white/35 bg-white/10 text-white"
                                                : "rounded-bl-md border-[#e7c46d] bg-[#fff8e7] text-[#6d5200]"
                                        }`
                                        : isStickerBubble
                                        ? "max-w-[220px] overflow-visible bg-transparent p-0 shadow-none"
                                        : isAudioBubble
                                        ? `max-w-[86%] md:max-w-[66%] overflow-hidden rounded-2xl px-2.5 py-[0.7rem] ${
                                            message.fromMe ? "rounded-br-md bg-io-purple text-white" : "rounded-bl-md bg-white text-io-dark shadow-sm"
                                        }`
                                        : `max-w-[82%] md:max-w-[62%] overflow-hidden rounded-2xl px-3 py-2 text-sm shadow-sm ${
                                            message.fromMe ? "rounded-br-md bg-io-purple text-white" : "rounded-bl-md bg-white text-io-dark"
                                        }`;
                                    return (
                                        <div key={entry.id} className={`flex min-w-0 ${message.fromMe ? "justify-end" : "justify-start"}`}>
                                            <div className={bubbleClass}>
                                                {isInvalidBubble ? (
                                                    <div className="space-y-2">
                                                        <div
                                                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                                                                message.fromMe ? "bg-white/10 text-white/85" : "bg-[#fff1c7] text-[#9a6a00]"
                                                            }`}
                                                        >
                                                            <MessageCircleMore className="h-3.5 w-3.5" strokeWidth={1.8} />
                                                            <span>Mensagem inválida</span>
                                                        </div>
                                                        <p className={`text-sm font-medium ${message.fromMe ? "text-white" : "text-[#6d5200]"}`}>
                                                            {invalidMessageNotice}
                                                        </p>
                                                        <p className={`text-[11px] ${message.fromMe ? "text-white/70" : "text-[#9a6a00]/80"}`}>
                                                            Tipo recebido: {invalidMessageTypeDetail}
                                                        </p>
                                                    </div>
                                                ) : resolvedMediaType === "video" && message.videoUrl ? (
                                                    <div className="space-y-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => openMediaViewer(message, "video", message.videoUrl ?? "")}
                                                            className="relative inline-block max-w-[300px]"
                                                        >
                                                            <video
                                                                src={message.videoUrl}
                                                                className="max-h-[300px] max-w-[300px] rounded-lg object-contain"
                                                                onLoadedMetadata={() => scrollMessagesToBottom("auto")}
                                                            />
                                                            <span className="pointer-events-none absolute inset-0 grid place-items-center">
                                                                <span className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white">
                                                                    <Play className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                                                                </span>
                                                            </span>
                                                        </button>
                                                        {message.text && message.text !== "[Vídeo]" ? (
                                                            <MessageText text={message.text} className={getMessageTextClass(message.text)} linkClassName={linkToneClass} />
                                                        ) : null}
                                                    </div>
                                                ) : resolvedMediaType === "image" && message.imageUrl ? (
                                                    <div className="space-y-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => openMediaViewer(message, "image", message.imageUrl ?? "")}
                                                            className="inline-block max-w-[300px]"
                                                        >
                                                            <img
                                                                src={message.imageUrl}
                                                                alt="Imagem enviada"
                                                                className="max-h-[300px] max-w-[300px] rounded-lg object-contain"
                                                                onLoad={() => scrollMessagesToBottom("auto")}
                                                            />
                                                        </button>
                                                        {message.text && message.text !== "[Imagem]" ? (
                                                            <MessageText text={message.text} className={getMessageTextClass(message.text)} linkClassName={linkToneClass} />
                                                        ) : null}
                                                    </div>
                                                ) : resolvedMediaType === "sticker" && message.stickerUrl ? (
                                                    <div className="space-y-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => openMediaViewer(message, "image", message.stickerUrl ?? "")}
                                                            className="inline-block rounded-2xl bg-transparent p-1"
                                                        >
                                                            <img
                                                                src={message.stickerUrl}
                                                                alt="Figurinha recebida"
                                                                className="max-h-[180px] max-w-[180px] object-contain"
                                                                onLoad={() => scrollMessagesToBottom("auto")}
                                                            />
                                                        </button>
                                                        {message.text && message.text !== "[Sticker]" && message.text !== "[Figurinha]" ? (
                                                            <MessageText text={message.text} className={getMessageTextClass(message.text)} linkClassName={linkToneClass} />
                                                        ) : null}
                                                    </div>
                                                ) : resolvedMediaType === "document" && message.documentUrl ? (
                                                    <div className="space-y-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleDownloadDocument(message.documentUrl ?? "", message.documentName)}
                                                            className={`flex w-full min-w-[220px] max-w-[320px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                                                                message.fromMe
                                                                    ? "border-white/20 bg-white/10 hover:bg-white/15"
                                                                    : "border-black/10 bg-black/5 hover:bg-black/10"
                                                            }`}
                                                        >
                                                            <span
                                                                className={`grid h-11 w-11 flex-none place-items-center rounded-xl ${
                                                                    message.fromMe ? "bg-white/15 text-white" : "bg-violet-100 text-violet-700"
                                                                }`}
                                                            >
                                                                <FileText className="h-5 w-5" strokeWidth={1.8} />
                                                            </span>
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate text-sm font-semibold">
                                                                    {message.documentName || (message.text && message.text !== "[Documento]" ? message.text : "Documento")}
                                                                </span>
                                                                <span className={`block text-xs ${message.fromMe ? "text-white/70" : "text-black/50"}`}>
                                                                    Toque para baixar
                                                                </span>
                                                            </span>
                                                        </button>
                                                        {message.text && message.text !== "[Documento]" && message.text !== message.documentName ? (
                                                            <MessageText text={message.text} className={getMessageTextClass(message.text)} linkClassName={linkToneClass} />
                                                        ) : null}
                                                    </div>
                                                ) : resolvedMediaType === "audio" && message.audioUrl ? (
                                                    <AudioMessageInline
                                                        src={message.audioUrl}
                                                        fromMe={message.fromMe}
                                                        timeLabel={message.at}
                                                        status={message.status}
                                                        contactPhotoUrl={message.fromMe ? currentUserPhotoUrl : (selectedChat?.photoUrl ?? null)}
                                                        contactInitials={message.fromMe ? toInitials(currentUserName || "Você") : toInitials(selectedChat?.name ?? "Contato")}
                                                    />
                                                ) : (
                                                    message.text ? (
                                                        <MessageText text={message.text} className={getMessageTextClass(message.text)} linkClassName={linkToneClass} />
                                                    ) : null
                                                )}
                                                {message.pending ? (
                                                    <div className={`mt-1 space-y-1 text-[10px] ${message.fromMe ? "text-white/80" : "text-black/55"}`}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
                                                            <span>{message.pendingLabel ?? "Processando..."}</span>
                                                            {message.type === "video" && typeof message.pendingProgress === "number" ? (
                                                                <span>{Math.min(100, Math.max(0, Math.round(message.pendingProgress)))}%</span>
                                                            ) : null}
                                                        </div>
                                                        {message.type === "video" && typeof message.pendingProgress === "number" ? (
                                                            <div className={`h-1.5 w-full overflow-hidden rounded-full ${message.fromMe ? "bg-white/20" : "bg-black/10"}`}>
                                                                <div
                                                                    className={`h-full rounded-full ${message.fromMe ? "bg-white" : "bg-violet-600"}`}
                                                                    style={{ width: `${Math.min(100, Math.max(0, message.pendingProgress))}%` }}
                                                                />
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ) : resolvedMediaType === "audio" ? null : (
                                                    <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${message.fromMe ? "text-white/70" : "text-black/45"}`}>
                                                        <span>{message.at}</span>
                                                        {message.fromMe ? <MessageStatusCheck status={toOutgoingMessageStatus(message.status)} /> : null}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <footer className="border-t border-black/10 bg-white p-3">
                                {selectedChatIsUnassigned || selectedChatIsTeamQueue ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleStartAtendimento}
                                            disabled={isStarting}
                                            className="h-11 rounded-xl bg-io-purple px-4 text-sm font-semibold text-white transition hover:brightness-110"
                                        >
                                            {isStarting ? "Iniciando..." : "Iniciar atendimento"}
                                        </button>
                                    </div>
                                ) : selectedChatIsAssignedToTeammate ? (
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-black/60">Atendimento em andamento com {selectedChat.assignedUserName ?? "outro atendente"}.</p>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        {!isRecordingAudio && !recordedAudioUrl && (
                                            <div ref={attachmentMenuRef} className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsEmojiPickerOpen(false);
                                                        setIsAttachmentMenuOpen((open) => !open);
                                                    }}
                                                    className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 text-black/65 transition hover:bg-black/5"
                                                    aria-label="Anexar arquivo"
                                                >
                                                    <Paperclip className="h-5 w-5" strokeWidth={2} />
                                                </button>
                                                {isAttachmentMenuOpen && (
                                                    <div className="absolute bottom-12 left-0 z-30 w-56 rounded-xl border border-black/10 bg-white p-1 shadow-lg">
                                                        <button
                                                            type="button"
                                                            onClick={openGalleryPicker}
                                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-io-dark hover:bg-black/5"
                                                        >
                                                            <ImageIcon className="h-4 w-4" strokeWidth={2} />
                                                            <span>Enviar imagem</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={openVideoPicker}
                                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-io-dark hover:bg-black/5"
                                                        >
                                                            <Video className="h-4 w-4" strokeWidth={2} />
                                                            <span>Enviar vídeo</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={openDocumentPicker}
                                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-io-dark hover:bg-black/5"
                                                        >
                                                            <FileText className="h-4 w-4" strokeWidth={2} />
                                                            <span>Enviar documento</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {!isRecordingAudio && !recordedAudioUrl && (
                                            <div ref={emojiPickerRef} className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsAttachmentMenuOpen(false);
                                                        setIsEmojiPickerOpen((open) => !open);
                                                    }}
                                                    className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 text-black/65 transition hover:bg-black/5"
                                                    aria-label="Abrir emojis"
                                                >
                                                    <Smile className="h-5 w-5" strokeWidth={2} />
                                                </button>
                                                {isEmojiPickerOpen && (
                                                    <ChatEmojiPicker onSelect={handleInsertEmoji} />
                                                )}
                                            </div>
                                        )}

                                        {isRecordingAudio ? (
                                            <div className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-black/10 bg-black/[0.03] px-3">
                                                <span className="whitespace-nowrap text-xs font-medium text-io-dark">Gravando...</span>
                                                <div className="grid h-6 min-w-0 flex-1 grid-cols-[repeat(36,minmax(0,1fr))] items-end gap-[2px]">
                                                    {audioWaveform.map((value, index) => (
                                                        <span
                                                            key={`rec-wave-${index}`}
                                                            className="block w-full rounded-full bg-[#d10f9a]"
                                                            style={{ height: `${Math.max(3, Math.round(24 * value))}px` }}
                                                        />
                                                    ))}
                                                </div>
                                                <span className="w-10 text-right text-xs font-medium text-io-dark">{formatDurationSeconds(audioRecordSeconds)}</span>
                                                <button
                                                    type="button"
                                                    onClick={stopAudioRecording}
                                                    className="grid h-8 w-8 place-items-center rounded-full border border-black/15 text-black/70 transition hover:bg-black/5"
                                                    aria-label="Parar gravação"
                                                >
                                                    <span className="h-2.5 w-2.5 rounded-sm bg-current" />
                                                </button>
                                            </div>
                                        ) : recordedAudioUrl ? (
                                            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-black/10 bg-black/[0.03] px-2">
                                                <button
                                                    type="button"
                                                    onClick={clearRecordedAudio}
                                                    className="grid h-8 w-8 place-items-center rounded-full border border-black/15 text-red-600 transition hover:bg-red-50"
                                                    aria-label="Excluir áudio"
                                                >
                                                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={toggleRecordedAudioPlayback}
                                                    className="grid h-8 w-8 place-items-center rounded-full border border-black/15 text-black/80 transition hover:bg-black/5"
                                                    aria-label={isRecordedAudioPlaying ? "Pausar áudio" : "Reproduzir áudio"}
                                                >
                                                    {isRecordedAudioPlaying ? (
                                                        <span className="h-2.5 w-2.5 rounded-sm bg-current" />
                                                    ) : (
                                                        <Play className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                                                    )}
                                                </button>
                                                <button type="button" onClick={seekRecordedAudio} className="min-w-0 flex-1">
                                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/15">
                                                        <div
                                                            className="h-full rounded-full bg-violet-600"
                                                            style={{
                                                                width: `${Math.min(
                                                                    100,
                                                                    Math.max(
                                                                        0,
                                                                        ((recordedAudioCurrentTime || 0) / Math.max(1, recordedAudioDuration || audioRecordSeconds || 1)) * 100
                                                                    )
                                                                )}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </button>
                                                <span className="w-24 text-right text-xs font-medium text-black/70">
                                                    {formatDurationSeconds(Math.round(recordedAudioCurrentTime))} / {formatDurationSeconds(Math.round(recordedAudioDuration || audioRecordSeconds))}
                                                </span>
                                                <audio ref={audioPreviewRef} src={recordedAudioUrl} className="hidden" preload="metadata" />
                                                <button
                                                    type="button"
                                                    onClick={sendRecordedAudio}
                                                    disabled={isSendingMedia}
                                                    className="grid h-9 w-9 place-items-center rounded-full bg-io-purple text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                                    aria-label="Enviar áudio"
                                                >
                                                    <SendHorizonal className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <textarea
                                                    ref={draftInputRef}
                                                    value={selectedChatDraft}
                                                    onChange={(event) => setDraftForChat(selectedId, event.target.value)}
                                                    onInput={syncDraftInputHeight}
                                                    onPaste={handleDraftPaste}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter" && !event.shiftKey) {
                                                            event.preventDefault();
                                                            void handleSendMessage();
                                                        }
                                                    }}
                                                    rows={1}
                                                    placeholder="Digite sua mensagem..."
                                                    className="io-scrollbar-hidden min-h-[44px] max-h-32 w-full resize-none overflow-y-auto rounded-xl border border-black/10 px-3 py-3 text-sm text-io-dark outline-none transition focus:border-io-purple focus:ring-4 focus:ring-io-purple/10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (selectedChatDraftTrimmed) {
                                                            void handleSendMessage();
                                                            return;
                                                        }
                                                        void startAudioRecording();
                                                    }}
                                                    disabled={isSendingText || isSendingMedia}
                                                    className="grid h-11 w-11 place-items-center rounded-xl bg-io-purple text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                                    aria-label={selectedChatDraftTrimmed ? "Enviar mensagem" : "Gravar áudio"}
                                                >
                                                    {selectedChatDraftTrimmed ? (
                                                        <SendHorizonal className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                                                    ) : (
                                                        <Mic className="h-5 w-5" strokeWidth={2} />
                                                    )}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                                {sendError && <p className="mt-2 text-xs text-red-600">{sendError}</p>}
                            </footer>
                                    </div>

                                </div>

                                {isContactSidebarVisible && (
                                    <div
                                        className={`absolute inset-0 z-20 flex justify-end transition-opacity duration-[220ms] ${
                                            isContactSidebarActive ? "bg-black/20 opacity-100 lg:bg-transparent" : "bg-black/0 opacity-0"
                                        }`}
                                        onClick={closeContactSidebar}
                                    >
                                        <div className="ml-auto h-full" onClick={(event) => event.stopPropagation()}>
                                            {renderContactSidebar()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="grid h-full place-items-center bg-[#eef0f4] px-4">
                            <div className="text-center text-[#5f6f8d]">
                                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border-2 border-current/70">
                                    <MessageCircleMore className="h-8 w-8" strokeWidth={2} />
                                </div>
                                <p className="mt-3 text-xl font-semibold text-current">Escolha um atendimento para iniciar a conversa</p>
                            </div>
                        </div>
                    )}
                </section>
            <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageInputChange}
                className="hidden"
            />
            <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoInputChange}
                className="hidden"
            />
            <input
                ref={documentInputRef}
                type="file"
                onChange={handleDocumentInputChange}
                className="hidden"
            />
            {isVideoPreviewOpen && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-3">
                    <div className="grid h-[94vh] w-full max-w-md grid-rows-[auto_auto_1fr_auto_auto] gap-2 rounded-2xl bg-white p-2 shadow-2xl">
                        <div className="flex items-center justify-between px-1 pt-1">
                            <button
                                type="button"
                                onClick={closeVideoPreview}
                                aria-label="Fechar"
                                className="grid h-10 w-10 place-items-center rounded-full bg-black/10 text-black/80"
                            >
                                <X className="h-5 w-5" strokeWidth={2} />
                            </button>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setVideoEditorMode("draw")}
                                    className={`grid h-10 w-10 place-items-center rounded-full ${videoEditorMode === "draw" ? "bg-black/10 text-io-dark" : "text-black/70 hover:bg-black/5"}`}
                                    aria-label="Desenhar"
                                    title="Desenhar"
                                >
                                    <Pencil className="h-5 w-5" strokeWidth={2} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVideoPreviewMuted((current) => !current)}
                                    className="grid h-10 w-10 place-items-center rounded-full text-black/70 hover:bg-black/5"
                                    aria-label={videoPreviewMuted ? "Ativar som" : "Silenciar"}
                                    title={videoPreviewMuted ? "Ativar som" : "Silenciar"}
                                >
                                    {videoPreviewMuted ? (
                                        <VolumeX className="h-5 w-5" strokeWidth={2} />
                                    ) : (
                                        <Volume2 className="h-5 w-5" strokeWidth={2} />
                                    )}
                                </button>
                                <div className="flex items-center gap-1">
                                    {BRUSH_COLORS.map((color) => (
                                        <button
                                            key={`video-color-${color}`}
                                            type="button"
                                            onClick={() => setImageDrawColor(color)}
                                            className={`h-6 w-6 rounded-full border ${imageDrawColor === color ? "border-black ring-2 ring-black/25" : "border-black/20"}`}
                                            style={{ backgroundColor: color }}
                                            aria-label={`Cor ${color}`}
                                            title={color}
                                        />
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={undoVideoEditorChange}
                                    disabled={videoEditorHistory.length === 0}
                                    className="grid h-10 w-10 place-items-center rounded-full text-black/70 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label="Desfazer"
                                    title="Desfazer"
                                >
                                    <Undo2 className="h-5 w-5" strokeWidth={1.8} />
                                </button>
                            </div>
                        </div>

                        <div className="grid min-h-0 place-items-center overflow-hidden rounded-xl bg-[#f3f4f8]">
                            <div
                                ref={videoOverlayStageRef}
                                onPointerMove={handleVideoStagePointerMove}
                                onPointerUp={stopVideoTextDrag}
                                onPointerLeave={stopVideoTextDrag}
                                className="relative max-h-full w-full"
                            >
                                <video
                                    ref={videoPreviewRef}
                                    src={videoPreviewSource}
                                    controls
                                    autoPlay
                                    playsInline
                                    muted={videoPreviewMuted}
                                    onPlay={() => setIsVideoPreviewPlaying(true)}
                                    onPause={() => setIsVideoPreviewPlaying(false)}
                                    onLoadedMetadata={(event) => {
                                        const element = event.currentTarget;
                                        setVideoPreviewDuration(element.duration || 0);
                                        const overlay = videoOverlayCanvasRef.current;
                                        if (!overlay) return;
                                        overlay.width = Math.max(1, Math.floor(element.videoWidth || 1));
                                        overlay.height = Math.max(1, Math.floor(element.videoHeight || 1));
                                        const ctx = overlay.getContext("2d");
                                        if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
                                        setVideoTextLayers([]);
                                        setSelectedVideoTextLayerId(null);
                                    }}
                                    onTimeUpdate={(event) => {
                                        setVideoPreviewCurrentTime(event.currentTarget.currentTime || 0);
                                    }}
                                    className="max-h-full w-full object-contain"
                                />
                                <canvas
                                    ref={videoOverlayCanvasRef}
                                    onPointerDown={handleVideoOverlayPointerDown}
                                    onPointerMove={handleVideoOverlayPointerMove}
                                    onPointerUp={stopVideoDrawing}
                                    onPointerLeave={stopVideoDrawing}
                                    className="pointer-events-auto absolute inset-0 h-full w-full touch-none"
                                />
                                {videoTextLayers.map((layer) => (
                                    <div
                                        key={layer.id}
                                        style={{ left: layer.x, top: layer.y, width: layer.boxWidth }}
                                        className={`absolute rounded-md border ${selectedVideoTextLayerId === layer.id ? "border-violet-400" : "border-black/10"} bg-white p-1 shadow-sm`}
                                        onMouseDown={() => setSelectedVideoTextLayerId(layer.id)}
                                    >
                                        <button
                                            type="button"
                                            onPointerDown={(event) => handleVideoTextDragStart(layer.id, event)}
                                            className="mb-1 rounded bg-black/10 px-1.5 py-0.5 text-[10px] text-black/80"
                                            aria-label="Mover texto"
                                        >
                                            mover
                                        </button>
                                        <textarea
                                            value={layer.text}
                                            onChange={(event) => updateVideoTextLayer(layer.id, (current) => ({ ...current, text: event.target.value }))}
                                            onFocus={() => setSelectedVideoTextLayerId(layer.id)}
                                            className="min-h-[32px] w-full resize-none bg-transparent text-sm font-semibold leading-5 text-io-dark outline-none"
                                            style={{ color: layer.color, fontSize: `${layer.fontSize}px` }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-xl bg-black/5 px-3 py-2">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const video = videoPreviewRef.current;
                                        if (!video) return;
                                        if (video.paused) {
                                            void video.play();
                                            return;
                                        }
                                        video.pause();
                                    }}
                                    className="grid h-9 w-9 place-items-center rounded-full bg-white text-io-dark"
                                    aria-label={isVideoPreviewPlaying ? "Pausar vídeo" : "Iniciar vídeo"}
                                >
                                    {isVideoPreviewPlaying ? <Pause className="h-4 w-4" strokeWidth={2} /> : <Play className="h-4 w-4" strokeWidth={2} />}
                                </button>
                                <div className="w-full">
                                    <input
                                        type="range"
                                        min={0}
                                        max={videoPreviewDuration > 0 ? videoPreviewDuration : 1}
                                        step={0.1}
                                        value={videoPreviewCurrentTime}
                                        onChange={(event) => {
                                            const next = Number(event.target.value);
                                            setVideoPreviewCurrentTime(next);
                                            if (videoPreviewRef.current) {
                                                videoPreviewRef.current.currentTime = next;
                                            }
                                        }}
                                        className="w-full accent-violet-600"
                                        aria-label="Timeline do vídeo"
                                    />
                                    <div className="mt-1 flex items-center justify-between text-xs text-black/65">
                                        <span>{Math.floor(videoPreviewCurrentTime / 60)}:{String(Math.floor(videoPreviewCurrentTime % 60)).padStart(2, "0")}</span>
                                        <span>{Math.floor(videoPreviewDuration / 60)}:{String(Math.floor(videoPreviewDuration % 60)).padStart(2, "0")}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl bg-black/5 p-2">
                            <input
                                value={videoPreviewCaption}
                                onChange={(event) => setVideoPreviewCaption(event.target.value)}
                                placeholder="Adicione uma legenda..."
                                className="h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm text-io-dark outline-none placeholder:text-black/45"
                            />
                            <button
                                type="button"
                                onClick={confirmVideoSendFromPreview}
                                disabled={isSendingMedia}
                                className="grid h-11 w-11 place-items-center rounded-full bg-violet-600 text-white disabled:opacity-60"
                                aria-label="Enviar vídeo"
                            >
                                {isSendingMedia ? (
                                    <span className="text-[10px] font-semibold">...</span>
                                ) : (
                                    <SendHorizonal className="h-5 w-5" strokeWidth={2} />
                                )}
                            </button>
                        </div>
                        {sendError && <p className="px-2 text-xs text-red-600">{sendError}</p>}
                    </div>
                </div>
            )}
            {isImagePreviewOpen && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-3">
                    <div className="grid h-[90vh] w-full max-w-5xl grid-rows-[auto_1fr_auto] gap-3 rounded-2xl bg-white p-3 shadow-2xl">
                        <div className="flex flex-wrap items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setImageEditorMode("draw")}
                                aria-label="Desenhar"
                                title="Desenhar"
                                className={`grid h-10 w-10 place-items-center rounded-full ${imageEditorMode === "draw" ? "bg-black/10 text-io-dark" : "text-black/70 hover:bg-black/5"}`}
                            >
                                <Pencil className="h-5 w-5" strokeWidth={1.8} />
                            </button>
                            <button
                                type="button"
                                onClick={addTextLayer}
                                aria-label="Adicionar texto"
                                title="Adicionar texto"
                                className={`grid h-10 w-10 place-items-center rounded-full ${imageEditorMode === "text" ? "bg-black/10 text-io-dark" : "text-black/70 hover:bg-black/5"}`}
                            >
                                <span className="text-sm font-semibold">Aa</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setImageEditorMode("crop")}
                                aria-label="Cortar"
                                title="Cortar"
                                className={`grid h-10 w-10 place-items-center rounded-full ${imageEditorMode === "crop" ? "bg-black/10 text-io-dark" : "text-black/70 hover:bg-black/5"}`}
                            >
                                <Crop className="h-5 w-5" strokeWidth={1.8} />
                            </button>
                            <button
                                type="button"
                                onClick={() => rotateImage("cw")}
                                aria-label="Girar imagem"
                                title="Girar imagem"
                                className="grid h-10 w-10 place-items-center rounded-full text-black/70 hover:bg-black/5"
                            >
                                <RotateCw className="h-5 w-5" strokeWidth={1.8} />
                            </button>
                            <div className="flex items-center gap-1.5">
                                {BRUSH_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setImageDrawColor(color)}
                                        aria-label={`Cor ${color}`}
                                        title={color}
                                        className={`h-7 w-7 rounded-full border ${imageDrawColor === color ? "border-black ring-2 ring-black/30" : "border-black/20"}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={16}
                                step={1}
                                value={imageDrawSize}
                                onChange={(event) => setImageDrawSize(Number(event.target.value))}
                                className="w-24"
                                aria-label="Espessura do pincel"
                            />
                            <button
                                type="button"
                                onClick={undoEditorChange}
                                aria-label="Desfazer"
                                title="Desfazer"
                                disabled={editorHistory.length === 0}
                                className="grid h-10 w-10 place-items-center rounded-full text-black/70 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Undo2 className="h-5 w-5" strokeWidth={1.8} />
                            </button>
                        </div>

                        <div className="grid min-h-0 place-items-center overflow-auto rounded-xl bg-[#f3f4f8]">
                            <div
                                ref={imageEditorStageRef}
                                onPointerMove={handleEditorStagePointerMove}
                                onPointerUp={stopTextDrag}
                                onPointerLeave={stopTextDrag}
                                className="relative"
                            >
                                <canvas
                                    ref={imageEditorCanvasRef}
                                    onPointerDown={handleEditorPointerDown}
                                    onPointerMove={handleEditorPointerMove}
                                    onPointerUp={handleEditorPointerUp}
                                    onPointerLeave={handleEditorPointerUp}
                                    className="block touch-none rounded-lg"
                                />
                                {imageTextLayers.map((layer) => (
                                    <div
                                        key={layer.id}
                                        style={{
                                            left: layer.x,
                                            top: layer.y,
                                            width: layer.boxWidth,
                                            transform: `rotate(${layer.rotation}deg)`,
                                            transformOrigin: "top left",
                                        }}
                                        className={`absolute rounded-md border ${selectedTextLayerId === layer.id ? "border-violet-400" : "border-black/10"} bg-white p-1 shadow-sm`}
                                        onMouseDown={() => setSelectedTextLayerId(layer.id)}
                                    >
                                        <div className="mb-1 flex items-center justify-between gap-1">
                                            <button
                                                type="button"
                                                className="grid h-6 w-6 place-items-center rounded bg-black/10 text-black/80"
                                                onPointerDown={(event) => handleTextDragStart(layer.id, event)}
                                                aria-label="Mover texto"
                                                title="Mover"
                                            >
                                                <Move className="h-3.5 w-3.5" strokeWidth={2} />
                                            </button>
                                            <button
                                                type="button"
                                                className="grid h-6 w-6 place-items-center rounded bg-black/10 text-black/80"
                                                onPointerDown={(event) => handleTextResizeStart(layer.id, event)}
                                                aria-label="Redimensionar texto"
                                                title="Redimensionar"
                                            >
                                                <Expand className="h-3.5 w-3.5" strokeWidth={2} />
                                            </button>
                                        </div>
                                        <textarea
                                            value={layer.text}
                                            onChange={(event) => updateTextLayer(layer.id, (current) => ({ ...current, text: event.target.value }))}
                                            onFocus={() => setSelectedTextLayerId(layer.id)}
                                            className="min-h-[40px] w-full resize-none bg-transparent text-sm font-semibold leading-5 text-white outline-none"
                                            style={{ color: layer.color, fontSize: `${layer.fontSize}px` }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setImageTextLayers((previous) => previous.filter((item) => item.id !== layer.id))}
                                            className="mt-1 grid h-6 w-6 place-items-center rounded bg-black/10 text-black/80"
                                            aria-label="Remover texto"
                                            title="Remover"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                                        </button>
                                    </div>
                                ))}
                                {cropBox && (
                                    <div
                                        className="pointer-events-none absolute border-2 border-violet-400 bg-violet-500/20"
                                        style={{
                                            left: cropBox.x,
                                            top: cropBox.y,
                                            width: cropBox.w,
                                            height: cropBox.h,
                                        }}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                            <input
                                value={imagePreviewCaption}
                                onChange={(event) => setImagePreviewCaption(event.target.value)}
                                placeholder="Legenda da imagem"
                                className="h-11 rounded-xl border border-black/15 bg-black/5 px-3 text-sm text-io-dark outline-none placeholder:text-black/45"
                            />
                            <button
                                type="button"
                                onClick={closeImagePreview}
                                className="h-11 rounded-xl border border-black/20 px-4 text-sm font-semibold text-io-dark"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmImageSendFromPreview}
                                disabled={isSendingMedia}
                                className="inline-flex h-11 items-center gap-1 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white"
                            >
                                <SendHorizonal className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                                <span>{isSendingMedia ? "Enviando..." : "Enviar imagem"}</span>
                            </button>
                        </div>
                        {sendError && <p className="px-1 text-xs text-red-600">{sendError}</p>}
                    </div>
                </div>
            )}
            {isConcludeModalOpen && selectedChat && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
                    <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-xl">
                        <div className="mb-3">
                            <p className="text-2xl font-semibold text-io-dark">Classificar atendimento</p>
                            <p className="text-xs text-black/60">{selectedChat.name} - {formatContactPhone(selectedChat.displayPhone || selectedChat.phone)}</p>
                        </div>

                        {concludeModalMsg && <section className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{concludeModalMsg}</section>}

                        <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4">
                            <div className="mb-3">
                                <div className="flex h-11 items-center rounded-xl border border-black/15 bg-white px-3">
                                    <input
                                        value={concludeSearchTerm}
                                        onChange={(event) => setConcludeSearchTerm(event.target.value)}
                                        placeholder="Pesquisar"
                                        className="h-full w-full bg-transparent text-sm text-io-dark outline-none placeholder:text-black/45"
                                    />
                                    <Search className="h-5 w-5 text-black/45" strokeWidth={2} />
                                </div>
                            </div>

                            <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-black/10 pb-3">
                                {classificationCategories.map((category) => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        onClick={() => setConcludeCategoryId(category.id)}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${concludeCategoryId === category.id ? "bg-white text-io-dark shadow-sm" : "text-[#5c6b8a] hover:bg-white"}`}
                                    >
                                        <AtendimentoClassificationCategoryIcon categoryId={category.id} className="mr-2 inline h-4 w-4 align-[-2px]" />
                                        {category.label}
                                    </button>
                                ))}
                            </div>

                            <section className="min-h-[220px] rounded-xl bg-[#f7f8fb] p-3">
                                <div className="grid gap-2">
                                    {concludeVisibleClassifications.length === 0 && (
                                        <p className="px-2 py-3 text-sm text-black/55">Nenhuma classificação encontrada nesta categoria.</p>
                                    )}
                                    {concludeVisibleClassifications.map((classification) => {
                                        const active = concludeClassificationId === classification.id;
                                        return (
                                            <button
                                                key={classification.id}
                                                type="button"
                                                onClick={() => setConcludeClassificationId(classification.id)}
                                                className={`flex items-center gap-3 rounded-none px-3 py-3 text-left text-sm ${active ? "bg-[#dbe8fb]" : "bg-white hover:bg-black/5"}`}
                                            >
                                                <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${active ? "border-blue-500" : "border-black/25"}`}>
                                                    {active ? <span className="h-2 w-2 rounded-full bg-blue-500" /> : null}
                                                </span>
                                                <span className="font-medium text-io-dark">
                                                    {classification.title}
                                                    {classification.hasValue && classification.value != null ? ` (Valor: ${classification.value})` : ""}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <div className="mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsManageClassificationsPopupOpen(true)}
                                    className="text-sm font-medium text-[#5a4af3] hover:underline"
                                >
                                    Alterar classificações de atendimento
                                </button>
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-lg font-semibold text-io-dark">Etiquetas</p>
                                <button
                                    type="button"
                                    onClick={() => setIsManageLabelsPopupOpen(true)}
                                    className="grid h-8 w-8 place-items-center rounded-lg border border-black/15 text-black/60 hover:bg-black/5"
                                    aria-label="Alterar etiquetas"
                                >
                                    <Pencil className="h-4 w-4" strokeWidth={2} />
                                </button>
                            </div>
                            <div className="min-h-14 rounded-xl border border-black/15 bg-white px-3 py-2">
                                <div className="flex flex-wrap gap-2">
                                    {concludeLabelIds.length === 0 ? (
                                        <p className="text-sm text-black/50">Sem etiquetas selecionadas.</p>
                                    ) : (
                                        availableLabels
                                            .filter((label) => concludeLabelIds.includes(label.id))
                                            .map((label) => <LabelBadge key={label.id} label={label} />)
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={closeConcludeModal} className="h-10 rounded-full border border-[#cfd6e4] px-6 text-sm font-medium text-[#5f6d8c]">Cancelar</button>
                            <button type="button" onClick={concludeSelectedChat} className="h-10 rounded-full bg-[#4f46e5] px-6 text-sm font-semibold text-white">
                                Concluir
                            </button>
                        </div>
                    </div>

                    {isManageClassificationsPopupOpen && (
                        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
                            <div className="w-full max-w-5xl rounded-2xl bg-white p-4 shadow-xl">
                                <div className="mb-3 flex items-center justify-between">
                                    <p className="text-base font-semibold text-io-dark">Gerenciar classificações</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsManageClassificationsPopupOpen(false);
                                            resetManageClassificationForm();
                                        }}
                                        className="text-sm text-black/60"
                                    >
                                        Fechar
                                    </button>
                                </div>
                                {manageClassificationMsg && <section className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{manageClassificationMsg}</section>}
                                {isManageClassificationFormOpen && (
                                    <div className="mb-3 grid gap-2 rounded-xl border border-black/10 bg-black/[0.02] p-3">
                                        <div className="grid grid-cols-[1fr_190px] gap-2">
                                            <input
                                                value={manageClassificationTitle}
                                                onChange={(event) => setManageClassificationTitle(event.target.value)}
                                                placeholder="Descrição da classificação"
                                                className="h-10 rounded-xl border px-3 text-sm"
                                            />
                                            <select
                                                value={manageClassificationCategoryId}
                                                onChange={(event) => setManageClassificationCategoryId(event.target.value as "achieved" | "lost" | "questions" | "other")}
                                                className="h-10 rounded-xl border px-3 text-sm"
                                            >
                                                {classificationCategories.map((category) => (
                                                    <option key={category.id} value={category.id}>{category.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                                            <label className="inline-flex items-center gap-2 text-sm text-io-dark">
                                                <input
                                                    type="checkbox"
                                                    checked={manageClassificationHasValue}
                                                    onChange={(event) => {
                                                        setManageClassificationHasValue(event.target.checked);
                                                        if (!event.target.checked) setManageClassificationValue("");
                                                    }}
                                                />
                                                Atribuir valor (R$)
                                            </label>
                                            {manageClassificationHasValue ? (
                                                <input
                                                    value={manageClassificationValue}
                                                    onChange={(event) => setManageClassificationValue(formatCurrencyBRLInput(event.target.value))}
                                                    placeholder="R$ 0,00"
                                                    inputMode="numeric"
                                                    className="h-10 rounded-xl border px-3 text-sm"
                                                />
                                            ) : <div />}
                                            <button type="button" onClick={saveManageClassificationInModal} className="h-10 rounded-xl bg-io-purple px-4 text-sm font-semibold text-white">
                                                {manageClassificationEditingId ? "Salvar" : "Adicionar"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="overflow-hidden rounded-xl border border-black/10">
                                    <div className="grid grid-cols-[2fr_2fr_1.4fr_96px] bg-[#f0f3f8] px-3 py-2 text-sm font-semibold text-[#5f6f8d]">
                                        <span className="text-left">Descrição</span>
                                        <span className="text-left">Categoria</span>
                                        <span className="text-left">Atribuir valor (R$)</span>
                                        <span className="text-right" />
                                    </div>
                                    <div className="max-h-72 overflow-y-auto">
                                        {availableClassifications.map((item) => {
                                            const categoryLabel = classificationCategories.find((c) => c.id === item.categoryId)?.label ?? "Outro";
                                            return (
                                                <div key={item.id} className="grid grid-cols-[2fr_2fr_1.4fr_96px] items-center border-t border-black/10 px-3 py-2 text-sm">
                                                    <span className="truncate text-io-dark">{item.title}</span>
                                                    <span className="truncate text-[#5f6f8d]">{categoryLabel}</span>
                                                    <button
                                                        type="button"
                                                        disabled={item.system}
                                                        onClick={() => toggleCustomClassificationValueFlag(item)}
                                                        className={`relative h-6 w-10 rounded-full transition ${item.hasValue ? "bg-io-purple" : "bg-black/20"} ${item.system ? "opacity-50" : ""}`}
                                                        title={item.system ? "Classificação padrão" : "Alternar valor"}
                                                    >
                                                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${item.hasValue ? "left-4" : "left-0.5"}`} />
                                                    </button>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={item.system}
                                                            onClick={() => openManageClassificationEditor(item)}
                                                            className={`grid h-8 w-8 place-items-center rounded-lg border border-black/15 text-[#5f6f8d] ${item.system ? "opacity-40" : "hover:bg-black/5"}`}
                                                            title={item.system ? "Classificação padrão" : "Editar"}
                                                        >
                                                            <Pencil className="h-4 w-4" strokeWidth={2} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={item.system}
                                                            onClick={() => removeCustomClassificationInModal(item)}
                                                            className={`grid h-8 w-8 place-items-center rounded-lg border border-black/15 text-[#5f6f8d] ${item.system ? "opacity-40" : "hover:bg-black/5"}`}
                                                            title={item.system ? "Classificação padrão" : "Excluir"}
                                                        >
                                                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="border-t border-black/10 px-3 py-2">
                                        <button
                                            type="button"
                                            onClick={() => openManageClassificationEditor()}
                                            className="text-sm font-medium text-[#5a4af3] hover:underline"
                                        >
                                            Adicionar nova classificação
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsManageClassificationsPopupOpen(false);
                                            resetManageClassificationForm();
                                        }}
                                        className="h-10 rounded-full border border-[#cfd6e4] px-5 text-sm font-medium text-[#5f6d8c]"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsManageClassificationsPopupOpen(false);
                                            resetManageClassificationForm();
                                        }}
                                        className="h-10 rounded-full bg-[#4f46e5] px-5 text-sm font-semibold text-white"
                                    >
                                        Salvar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isManageLabelsPopupOpen && (
                        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
                            <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
                                <div className="mb-3 flex items-center justify-between">
                                    <p className="text-base font-semibold text-io-dark">Gerenciar etiquetas</p>
                                    <button type="button" onClick={() => setIsManageLabelsPopupOpen(false)} className="text-sm text-black/60">Fechar</button>
                                </div>
                                <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-black/10 p-2">
                                    {availableLabels.map((label) => {
                                        const active = concludeLabelIds.includes(label.id);
                                        return (
                                            <div key={label.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-black/5">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleConcludeLabel(label.id)}
                                                    className="flex items-center gap-2"
                                                >
                                                    <LabelBadge label={label} />
                                                    {active ? <span className="text-xs font-semibold text-violet-700">Selecionada</span> : null}
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {availableLabels.length === 0 && <p className="p-2 text-sm text-black/55">Nenhuma etiqueta cadastrada.</p>}
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsManageLabelsPopupOpen(false)}
                                        className="h-10 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white"
                                    >
                                        Salvar etiquetas
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {mediaViewer && (
                <div className="fixed inset-0 z-[60] bg-black/85">
                    <div className="flex items-center justify-between px-4 py-3 text-white">
                        <div className="flex items-center gap-2">
                            {mediaViewer.senderPhotoUrl ? (
                                <img src={mediaViewer.senderPhotoUrl} alt={mediaViewer.sender} className="h-9 w-9 rounded-full object-cover" />
                            ) : (
                                <div className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-xs font-semibold text-white">
                                    {mediaViewer.senderAvatarText}
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-semibold">{mediaViewer.sender}</p>
                                <p className="text-xs text-white/70">{mediaViewer.at}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleDownloadMedia}
                                disabled={isDownloadingMedia}
                                aria-label="Baixar arquivo"
                                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Download className="h-5 w-5" strokeWidth={2} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setMediaViewer(null)}
                                aria-label="Fechar visualização"
                                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                            >
                                <X className="h-5 w-5" strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                    <div className="grid h-[calc(100%-64px)] place-items-center px-3 pb-3">
                        {mediaViewer.type === "image" ? (
                            <img src={mediaViewer.source} alt="Mídia" className="max-h-[80vh] max-w-[80vw] rounded-lg object-contain" />
                        ) : (
                            <video src={mediaViewer.source} controls autoPlay className="max-h-[70vh] max-w-[820px] rounded-lg object-contain" />
                        )}
                    </div>
                </div>
            )}
            {isDeleteConversationModalOpen && selectedChat && (
                <div
                    className="fixed inset-0 z-[60] grid place-items-center bg-black/40 px-4 py-6 -[2px]"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Confirmar exclusão da conversa"
                    onClick={closeDeleteConversationModal}
                >
                    <div
                        className="w-full max-w-md overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="border-b border-black/10 bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.12),_transparent_48%),linear-gradient(180deg,_rgba(255,255,255,1),_rgba(248,250,252,1))] px-5 py-5">
                            <div className="flex items-start gap-4">
                                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-red-100 bg-red-50 text-red-600">
                                    <Trash2 className="h-5 w-5" strokeWidth={2} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-lg font-semibold text-io-dark">Excluir conversa</p>
                                    <p className="mt-1 text-sm leading-6 text-black/60">
                                        Essa ação remove o histórico desse contato e não pode ser desfeita.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 px-5 py-5">
                            {deleteConversationModalMsg ? (
                                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                    {deleteConversationModalMsg}
                                </div>
                            ) : null}

                            <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">Contato</p>
                                <p className="mt-2 truncate text-base font-semibold text-io-dark">{selectedChat.name}</p>
                                <p className="mt-1 text-sm text-black/60">{formatContactPhone(selectedChat.displayPhone || selectedChat.phone)}</p>
                            </div>

                            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                                Apenas superadmins podem fazer essa exclusão.
                            </div>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeDeleteConversationModal}
                                    disabled={isDeletingContactConversation}
                                    className="h-11 rounded-xl border border-black/15 px-4 text-sm font-semibold text-io-dark transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={deleteSelectedConversation}
                                    disabled={isDeletingContactConversation}
                                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                                    <span>{isDeletingContactConversation ? "Excluindo..." : "Excluir conversa"}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {isTransferOpen && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
                        <p className="mb-1 text-sm font-semibold text-io-dark">
                            {transferMode === "manual" ? "Definir equipe do atendimento" : "Transferir atendimento"}
                        </p>
                        {transferMode === "manual" && (
                            <p className="mb-3 text-xs text-black/60">Contato: {formatContactPhone(manualTargetPhone)}</p>
                        )}
                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                                    Equipe
                                </label>
                                <select
                                    value={selectedTransferTeamId}
                                    onChange={(event) => setSelectedTransferTeamId(event.target.value)}
                                    className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-io-dark outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                >
                                    <option value="">Selecione uma equipe</option>
                                    {transferTeams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                                    Atendente
                                </label>
                                <select
                                    value={selectedTransferUserId}
                                    onChange={(event) => setSelectedTransferUserId(event.target.value)}
                                    disabled={!selectedTransferTeamId}
                                    className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-io-dark outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-black/40"
                                >
                                    <option value="">Sem atendente definido</option>
                                    {transferUsersForSelectedTeam.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.fullName}{user.id === currentUserId ? " (você)" : ""}
                                        </option>
                                    ))}
                                </select>
                                {selectedTransferTeamId && transferUsersForSelectedTeam.length === 0 ? (
                                    <p className="mt-2 text-xs text-black/55">Nenhum usuário disponível nessa equipe.</p>
                                ) : null}
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsTransferOpen(false)}
                                className="rounded-xl border border-black/15 px-3 py-2 text-sm text-io-dark"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleTransferAtendimento}
                                disabled={!selectedTransferTeamId || isTransferring}
                                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isTransferring ? "Salvando..." : transferMode === "manual" ? "Criar atendimento" : "Transferir atendimento"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
