"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock3, LifeBuoy, RefreshCcw, SendHorizontal } from "lucide-react";
import { formatDateTime, statusLabel } from "@/modules/ioauto/formatters";

type SupportTicketSummary = {
    ticketId: string;
    tenantId: string;
    companyName?: string | null;
    title: string;
    category: string;
    urgency: string;
    status: string;
    bugArea?: string | null;
    createdAt: string;
    firstResponseAt?: string | null;
    resolvedAt?: string | null;
    closedAt?: string | null;
};

type SupportTicketMessage = {
    id: string;
    ticketId: string;
    senderUserId?: string | null;
    senderType: string;
    message: string;
    createdAt: string;
};

type SupportTicketDetail = {
    ticketId: string;
    tenantId: string;
    companyName?: string | null;
    openedByUserId?: string | null;
    openedByName?: string | null;
    title: string;
    description: string;
    category: string;
    urgency: string;
    status: string;
    bugArea?: string | null;
    evidenceFileName?: string | null;
    evidenceContentType?: string | null;
    evidenceDataUrl?: string | null;
    createdAt: string;
    firstResponseAt?: string | null;
    resolvedAt?: string | null;
    closedAt?: string | null;
    messages: SupportTicketMessage[];
};

async function fetchJson<T>(url: string, init?: RequestInit, fallbackMessage = "Falha ao carregar os chamados.") {
    const response = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? fallbackMessage);
    }

    return (await response.json()) as T;
}

function categoryLabel(value?: string | null) {
    const normalized = String(value ?? "").trim().toUpperCase();
    const labels: Record<string, string> = {
        BUG: "Bug",
        QUESTION: "Duvida",
        BILLING: "Cobranca",
        INTEGRATION: "Integracao",
        FEATURE_REQUEST: "Sugestao",
        OTHER: "Outro",
    };
    return labels[normalized] ?? (normalized ? normalized.replaceAll("_", " ") : "-");
}

function urgencyLabel(value?: string | null) {
    const normalized = String(value ?? "").trim().toUpperCase();
    const labels: Record<string, string> = {
        LOW: "Baixa",
        MEDIUM: "Media",
        HIGH: "Alta",
        CRITICAL: "Critica",
    };
    return labels[normalized] ?? (normalized ? normalized.replaceAll("_", " ") : "-");
}

function statusTone(value?: string | null) {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "RESOLVED" || normalized === "CLOSED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (normalized === "WAITING_CUSTOMER") return "border-amber-200 bg-amber-50 text-amber-700";
    if (normalized === "IN_PROGRESS") return "border-sky-200 bg-sky-50 text-sky-700";
    return "border-violet-200 bg-violet-50 text-violet-700";
}

function urgencyTone(value?: string | null) {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "CRITICAL") return "border-rose-200 bg-rose-50 text-rose-700";
    if (normalized === "HIGH") return "border-orange-200 bg-orange-50 text-orange-700";
    if (normalized === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-slate-200 bg-slate-100 text-slate-700";
}

function isTicketConcluded(status?: string | null) {
    const normalized = String(status ?? "").trim().toUpperCase();
    return normalized === "RESOLVED" || normalized === "CLOSED";
}

function replyHelperText(status?: string | null) {
    const normalized = String(status ?? "").trim().toUpperCase();
    if (normalized === "WAITING_CUSTOMER") return "O suporte esta aguardando a sua resposta.";
    if (normalized === "RESOLVED" || normalized === "CLOSED") return "Este ticket foi concluido e nao aceita novas mensagens.";
    return "Digite sua mensagem para continuar a conversa com o suporte.";
}

export function SupportTicketsPage() {
    const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [ticketsError, setTicketsError] = useState<string | null>(null);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [ticketDetail, setTicketDetail] = useState<SupportTicketDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [replyDraft, setReplyDraft] = useState("");
    const [replyLoading, setReplyLoading] = useState(false);
    const [replyFeedback, setReplyFeedback] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const metrics = useMemo(() => {
        const openCount = tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status)).length;
        const waitingCount = tickets.filter((ticket) => ticket.status === "WAITING_CUSTOMER").length;
        const resolvedCount = tickets.filter((ticket) => ["RESOLVED", "CLOSED"].includes(ticket.status)).length;
        return { total: tickets.length, openCount, waitingCount, resolvedCount };
    }, [tickets]);

    async function loadTickets(preferredTicketId?: string | null, options?: { silent?: boolean }) {
        const silent = options?.silent ?? false;
        if (!silent) {
            setTicketsLoading(true);
            setTicketsError(null);
        }

        try {
            const payload = await fetchJson<SupportTicketSummary[]>("/api/support/tickets", undefined, "Falha ao carregar os chamados da empresa.");
            const nextTickets = Array.isArray(payload) ? payload : [];
            setTickets(nextTickets);

            const resolvedTicketId = preferredTicketId && nextTickets.some((ticket) => ticket.ticketId === preferredTicketId)
                ? preferredTicketId
                : nextTickets[0]?.ticketId ?? null;
            setSelectedTicketId(resolvedTicketId);
        } catch (requestError) {
            if (!silent) {
                setTickets([]);
                setSelectedTicketId(null);
                setTicketsError(requestError instanceof Error ? requestError.message : "Falha ao carregar os chamados da empresa.");
            }
        } finally {
            if (!silent) {
                setTicketsLoading(false);
            }
        }
    }

    async function loadTicketDetail(ticketId: string, options?: { silent?: boolean }) {
        const silent = options?.silent ?? false;
        if (!silent) {
            setDetailLoading(true);
            setDetailError(null);
        }

        try {
            const payload = await fetchJson<SupportTicketDetail>(
                `/api/support/tickets/${encodeURIComponent(ticketId)}`,
                undefined,
                "Falha ao carregar o chamado selecionado.",
            );
            setTicketDetail(payload);
        } catch (requestError) {
            if (!silent) {
                setTicketDetail(null);
                setDetailError(requestError instanceof Error ? requestError.message : "Falha ao carregar o chamado selecionado.");
            }
        } finally {
            if (!silent) {
                setDetailLoading(false);
            }
        }
    }

    async function handleReplySubmit() {
        if (!ticketDetail || !replyDraft.trim() || isTicketConcluded(ticketDetail.status)) return;

        setReplyLoading(true);
        setReplyFeedback(null);
        try {
            await fetchJson(
                `/api/support/tickets/${encodeURIComponent(ticketDetail.ticketId)}/messages`,
                {
                    method: "POST",
                    body: JSON.stringify({ message: replyDraft.trim() }),
                },
                "Falha ao enviar sua mensagem ao suporte.",
            );
            setReplyDraft("");
            setReplyFeedback("Mensagem enviada ao suporte.");
            await Promise.all([
                loadTickets(ticketDetail.ticketId, { silent: true }),
                loadTicketDetail(ticketDetail.ticketId, { silent: true }),
            ]);
        } catch (requestError) {
            setReplyFeedback(requestError instanceof Error ? requestError.message : "Falha ao enviar sua mensagem ao suporte.");
        } finally {
            setReplyLoading(false);
        }
    }

    async function handleManualRefresh() {
        await loadTickets(selectedTicketId);
        if (selectedTicketId) {
            await loadTicketDetail(selectedTicketId, { silent: true });
        }
    }

    function handleReplyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleReplySubmit();
        }
    }

    useEffect(() => {
        void loadTickets();
    }, []);

    useEffect(() => {
        if (!selectedTicketId) {
            setTicketDetail(null);
            setDetailError(null);
            setReplyDraft("");
            setReplyFeedback(null);
            return;
        }
        setReplyDraft("");
        setReplyFeedback(null);
        void loadTicketDetail(selectedTicketId);
    }, [selectedTicketId]);

    useEffect(() => {
        if (!selectedTicketId) return;

        const interval = window.setInterval(() => {
            void loadTickets(selectedTicketId, { silent: true });
            void loadTicketDetail(selectedTicketId, { silent: true });
        }, 5000);

        return () => window.clearInterval(interval);
    }, [selectedTicketId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [ticketDetail?.messages.length, selectedTicketId]);

    return (
        <section className="grid gap-6">
            <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Suporte</p>
                        <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-io-dark">Chamados da empresa</h1>
                        <p className="mt-3 text-sm leading-6 text-black/60">
                            Acompanhe todos os chamados da sua empresa, veja o status atual e converse com o time de suporte em uma unica tela.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => void handleManualRefresh()}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-black/10 px-4 text-sm font-semibold text-io-dark transition hover:border-black/20 hover:bg-black/[0.03]"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Atualizar conversa
                    </button>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-4">
                    <SummaryCard label="Total de chamados" value={String(metrics.total)} detail="Historico completo da empresa." icon={<LifeBuoy className="h-4 w-4" />} tone="violet" />
                    <SummaryCard label="Em aberto" value={String(metrics.openCount)} detail="Chamados ainda em andamento." icon={<Clock3 className="h-4 w-4" />} tone="sky" />
                    <SummaryCard label="Aguardando retorno" value={String(metrics.waitingCount)} detail="Tickets esperando resposta da empresa." icon={<AlertCircle className="h-4 w-4" />} tone="amber" />
                    <SummaryCard label="Resolvidos" value={String(metrics.resolvedCount)} detail="Chamados ja finalizados." icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[380px,minmax(0,1fr)]">
                <div className="rounded-[28px] border border-black/10 bg-white shadow-sm">
                    <div className="border-b border-black/6 px-5 py-4">
                        <h2 className="text-lg font-bold text-io-dark">Lista de chamados</h2>
                        <p className="mt-1 text-sm text-black/55">Todos os tickets registrados pela empresa aparecem aqui.</p>
                    </div>

                    <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-3">
                        {ticketsLoading ? (
                            <div className="rounded-3xl border border-dashed border-black/10 bg-black/[0.02] px-4 py-8 text-center text-sm text-black/55">
                                Carregando chamados...
                            </div>
                        ) : ticketsError ? (
                            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
                                {ticketsError}
                            </div>
                        ) : tickets.length ? (
                            <div className="grid gap-3">
                                {tickets.map((ticket) => {
                                    const active = ticket.ticketId === selectedTicketId;
                                    return (
                                        <button
                                            key={ticket.ticketId}
                                            type="button"
                                            onClick={() => setSelectedTicketId(ticket.ticketId)}
                                            className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                                                active
                                                    ? "border-cyan-300 bg-cyan-50 shadow-sm"
                                                    : "border-black/8 bg-white hover:border-black/15 hover:bg-black/[0.02]"
                                            }`}
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-io-dark">{ticket.title}</p>
                                                    <p className="mt-1 text-xs text-black/55">{ticket.bugArea || "Area nao informada"}</p>
                                                </div>
                                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(ticket.status)}`}>
                                                    {statusLabel(ticket.status)}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <Badge>{categoryLabel(ticket.category)}</Badge>
                                                <Badge className={urgencyTone(ticket.urgency)}>{urgencyLabel(ticket.urgency)}</Badge>
                                            </div>

                                            <div className="mt-3 text-xs text-black/45">
                                                <p>Abertura: {formatDateTime(ticket.createdAt)}</p>
                                                <p>Ultima etapa: {formatDateTime(ticket.closedAt || ticket.resolvedAt || ticket.firstResponseAt || ticket.createdAt)}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-[28px] border border-dashed border-black/10 bg-black/[0.02] px-5 py-10 text-center">
                                <p className="text-base font-semibold text-io-dark">Nenhum chamado encontrado</p>
                                <p className="mt-2 text-sm leading-6 text-black/55">
                                    Quando sua empresa abrir tickets de suporte, eles aparecerao aqui com status e historico de respostas.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-[28px] border border-black/10 bg-white shadow-sm">
                    <div className="border-b border-black/6 px-5 py-4">
                        <h2 className="text-lg font-bold text-io-dark">Detalhes do chamado</h2>
                        <p className="mt-1 text-sm text-black/55">Selecione um item da lista para acompanhar o andamento e responder o suporte.</p>
                    </div>

                    <div className="p-5">
                        {detailLoading ? (
                            <div className="rounded-[28px] border border-dashed border-black/10 bg-black/[0.02] px-5 py-12 text-center text-sm text-black/55">
                                Carregando detalhes do chamado...
                            </div>
                        ) : detailError ? (
                            <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
                                {detailError}
                            </div>
                        ) : ticketDetail ? (
                            <div className="grid gap-5">
                                <div className="rounded-[28px] border border-black/8 bg-black/[0.02] p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <h3 className="text-2xl font-black tracking-[-0.03em] text-io-dark">{ticketDetail.title}</h3>
                                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/65">{ticketDetail.description}</p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Badge className={statusTone(ticketDetail.status)}>{statusLabel(ticketDetail.status)}</Badge>
                                            <Badge>{categoryLabel(ticketDetail.category)}</Badge>
                                            <Badge className={urgencyTone(ticketDetail.urgency)}>{urgencyLabel(ticketDetail.urgency)}</Badge>
                                        </div>
                                    </div>

                                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <InfoCard label="Aberto por" value={ticketDetail.openedByName || "Usuario da empresa"} />
                                        <InfoCard label="Abertura" value={formatDateTime(ticketDetail.createdAt)} />
                                        <InfoCard label="Area" value={ticketDetail.bugArea || "-"} />
                                        <InfoCard label="Primeira resposta" value={formatDateTime(ticketDetail.firstResponseAt)} />
                                    </div>
                                </div>

                                {ticketDetail.evidenceDataUrl ? (
                                    <div className="rounded-[28px] border border-black/8 bg-white p-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <h3 className="text-base font-bold text-io-dark">Evidencia anexada</h3>
                                                <p className="mt-1 text-sm text-black/55">{ticketDetail.evidenceFileName || "Arquivo enviado no ticket"}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 overflow-hidden rounded-[24px] border border-black/8 bg-black/[0.03] p-3">
                                            {String(ticketDetail.evidenceContentType ?? "").startsWith("video/") ? (
                                                <video src={ticketDetail.evidenceDataUrl} controls className="max-h-[420px] w-full rounded-[20px] bg-black" />
                                            ) : (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={ticketDetail.evidenceDataUrl} alt="Evidencia do ticket" className="max-h-[420px] w-full rounded-[20px] object-contain" />
                                            )}
                                        </div>
                                    </div>
                                ) : null}

                                <div className="rounded-[28px] border border-black/8 bg-white p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-base font-bold text-io-dark">Conversa com o suporte</h3>
                                            <p className="mt-1 text-sm text-black/55">As novas mensagens aparecem automaticamente enquanto o ticket estiver ativo.</p>
                                        </div>
                                        <span className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs font-semibold text-black/55">
                                            {ticketDetail.messages.length} mensagem(ns)
                                        </span>
                                    </div>

                                    <div className="mt-4 max-h-[460px] overflow-y-auto rounded-[24px] border border-black/8 bg-black/[0.02] p-3">
                                        <div className="grid gap-3">
                                            {ticketDetail.messages.map((message) => {
                                                const fromSupport = message.senderType === "SUPPORT";
                                                return (
                                                    <article
                                                        key={message.id}
                                                        className={`rounded-[24px] border px-4 py-4 ${
                                                            fromSupport
                                                                ? "border-cyan-200 bg-cyan-50"
                                                                : "border-black/8 bg-white"
                                                        }`}
                                                    >
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <p className="text-sm font-bold text-io-dark">
                                                                {fromSupport ? "Time de suporte" : "Sua empresa"}
                                                            </p>
                                                            <p className="text-xs text-black/45">{formatDateTime(message.createdAt)}</p>
                                                        </div>
                                                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-black/65">{message.message}</p>
                                                    </article>
                                                );
                                            })}
                                            {!ticketDetail.messages.length ? (
                                                <p className="px-2 py-6 text-center text-sm text-black/55">Nenhuma mensagem registrada neste ticket.</p>
                                            ) : null}
                                            <div ref={messagesEndRef} />
                                        </div>
                                    </div>

                                    <div className="mt-4 rounded-[24px] border border-black/8 bg-white p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-io-dark">Responder chamado</p>
                                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(ticketDetail.status)}`}>
                                                {statusLabel(ticketDetail.status)}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm text-black/55">{replyHelperText(ticketDetail.status)}</p>

                                        <textarea
                                            value={replyDraft}
                                            onChange={(event) => setReplyDraft(event.target.value)}
                                            onKeyDown={handleReplyKeyDown}
                                            rows={4}
                                            disabled={replyLoading || isTicketConcluded(ticketDetail.status)}
                                            placeholder={isTicketConcluded(ticketDetail.status) ? "Ticket concluido." : "Digite sua mensagem para o suporte"}
                                            className="mt-4 w-full rounded-[20px] border border-black/12 px-4 py-3 text-sm leading-6 text-io-dark outline-none transition focus:border-black/25 disabled:cursor-not-allowed disabled:bg-black/[0.03]"
                                        />

                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                            <div className="text-sm text-black/55">
                                                {replyFeedback ? <p>{replyFeedback}</p> : <p>Pressione Enter para enviar e Shift + Enter para quebrar linha.</p>}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void handleReplySubmit()}
                                                disabled={replyLoading || !replyDraft.trim() || isTicketConcluded(ticketDetail.status)}
                                                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-io-dark px-5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <SendHorizontal className="h-4 w-4" />
                                                {replyLoading ? "Enviando..." : "Enviar mensagem"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-[28px] border border-dashed border-black/10 bg-black/[0.02] px-5 py-12 text-center">
                                <p className="text-base font-semibold text-io-dark">Selecione um chamado</p>
                                <p className="mt-2 text-sm leading-6 text-black/55">
                                    Escolha um ticket na coluna ao lado para visualizar o status atual, a evidencia enviada e as respostas do suporte.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

function SummaryCard({
    label,
    value,
    detail,
    icon,
    tone,
}: {
    label: string;
    value: string;
    detail: string;
    icon: ReactNode;
    tone: "violet" | "sky" | "amber" | "emerald";
}) {
    const toneClasses: Record<typeof tone, string> = {
        violet: "border-violet-200 bg-violet-50 text-violet-700",
        sky: "border-sky-200 bg-sky-50 text-sky-700",
        amber: "border-amber-200 bg-amber-50 text-amber-700",
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };

    return (
        <div className="rounded-[24px] border border-black/8 bg-black/[0.02] p-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-black/60">{label}</p>
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${toneClasses[tone]}`}>{icon}</span>
            </div>
            <p className="mt-4 text-3xl font-black tracking-[-0.03em] text-io-dark">{value}</p>
            <p className="mt-2 text-xs leading-5 text-black/50">{detail}</p>
        </div>
    );
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-[22px] border border-black/8 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/40">{label}</p>
            <p className="mt-2 text-sm font-semibold text-io-dark">{value}</p>
        </div>
    );
}

function Badge({
    children,
    className = "border-black/10 bg-white text-black/65",
}: {
    children: ReactNode;
    className?: string;
}) {
    return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}>{children}</span>;
}
