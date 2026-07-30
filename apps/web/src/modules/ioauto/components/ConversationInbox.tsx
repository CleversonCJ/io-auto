"use client";

import { useEffect, useMemo, useState } from "react";
import { CarFront, CheckCircle2, Globe2, LoaderCircle, MessageSquareText, PhoneCall } from "lucide-react";
import type { ConversationMessage, ConversationRecord, VehicleRecord } from "@/modules/ioauto/types";
import { formatDateTime, formatMoney, platformLabel, statusLabel } from "@/modules/ioauto/formatters";
import { SystemPageLoader } from "@/modules/shared/components/SystemPageLoader";

type TeamMember = {
    id: string;
    fullName: string;
    email: string;
    teamId: string | null;
    teamName: string | null;
};

function SourceIcon({ platform }: { platform?: string | null }) {
    const normalized = String(platform ?? "").trim().toUpperCase();
    if (normalized === "WEBMOTORS") return <CarFront className="h-4 w-4" />;
    return <Globe2 className="h-4 w-4" />;
}

function MessageBubble({ message }: { message: ConversationMessage }) {
    const mediaLink = message.imageUrl || message.videoUrl || message.documentUrl || message.audioUrl;

    return (
        <div className={`max-w-[35%] rounded-[18px] px-3.5 py-2 text-[13px] shadow-sm ${message.fromMe ? "ml-auto rounded-br-none bg-io-dark text-white" : "rounded-bl-none border border-black/5 bg-white text-black/80"}`}>
            {message.text ? <p className="whitespace-pre-wrap leading-5">{message.text}</p> : null}
            {message.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={message.imageUrl} alt="Mídia do atendimento" className="mt-2 max-h-48 w-full rounded-xl object-cover" />
            ) : null}
            {mediaLink && !message.imageUrl ? (
                <a href={mediaLink} target="_blank" rel="noreferrer" className={`mt-1.5 inline-flex text-[11px] underline ${message.fromMe ? "text-white/75" : "text-black/60"}`}>
                    Abrir anexo
                </a>
            ) : null}
            <div className="mt-1 flex items-center justify-end">
                <p className="text-[10px] opacity-50">{formatDateTime(message.createdAt)}</p>
            </div>
        </div>
    );
}

export function ConversationInbox() {
    const [conversations, setConversations] = useState<ConversationRecord[]>([]);
    const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ConversationMessage[]>([]);
    const [pageLoading, setPageLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);
    const [refreshTick, setRefreshTick] = useState(0);
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [selectedVehicleId, setSelectedVehicleId] = useState("");
    const [selectedSellerUserId, setSelectedSellerUserId] = useState("");
    const [saleSubmitting, setSaleSubmitting] = useState(false);
    const [saleMessage, setSaleMessage] = useState<string | null>(null);

    const selectedConversation = useMemo(
        () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
        [conversations, selectedId]
    );

    const saleableVehicles = useMemo(
        () => vehicles.filter((vehicle) => String(vehicle.status ?? "").trim().toUpperCase() !== "SOLD"),
        [vehicles]
    );

    useEffect(() => {
        let active = true;
        setPageLoading(true);

        Promise.all([
            fetch("/api/atendimentos/conversations", { cache: "no-store", credentials: "include" }),
            fetch("/api/ioauto/vehicles", { cache: "no-store", credentials: "include" }),
            fetch("/api/atendimentos/users", { cache: "no-store", credentials: "include" }),
        ])
            .then(async ([conversationsResponse, vehiclesResponse, usersResponse]) => {
                if (!conversationsResponse.ok) {
                    const payload = await conversationsResponse.json().catch(() => ({ message: "Falha ao listar leads." }));
                    throw new Error(payload.message ?? "Falha ao listar leads.");
                }
                if (!vehiclesResponse.ok) {
                    const payload = await vehiclesResponse.json().catch(() => ({ message: "Falha ao listar veículos." }));
                    throw new Error(payload.message ?? "Falha ao listar veículos.");
                }
                if (!usersResponse.ok) {
                    const payload = await usersResponse.json().catch(() => ({ message: "Falha ao listar a equipe." }));
                    throw new Error(payload.message ?? "Falha ao listar a equipe.");
                }
                return Promise.all([
                    conversationsResponse.json() as Promise<ConversationRecord[]>,
                    vehiclesResponse.json() as Promise<VehicleRecord[]>,
                    usersResponse.json() as Promise<TeamMember[]>,
                ]);
            })
            .then(([conversationPayload, vehiclePayload, usersPayload]) => {
                if (!active) return;
                setConversations(conversationPayload);
                setVehicles(vehiclePayload);
                setTeamMembers(usersPayload);
                setSelectedId((current) => current ?? conversationPayload[0]?.id ?? null);
                setPageError(null);
            })
            .catch((cause: Error) => {
                if (!active) return;
                setPageError(cause.message);
            })
            .finally(() => {
                if (active) setPageLoading(false);
            });

        return () => {
            active = false;
        };
    }, [refreshTick]);

    useEffect(() => {
        if (!selectedId) {
            setMessages([]);
            return;
        }

        let active = true;
        setLoadingMessages(true);
        fetch(`/api/atendimentos/conversations/${selectedId}/messages`, { cache: "no-store", credentials: "include" })
            .then(async (response) => {
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({ message: "Falha ao listar mensagens." }));
                    throw new Error(payload.message ?? "Falha ao listar mensagens.");
                }
                return response.json();
            })
            .then((payload: ConversationMessage[]) => {
                if (!active) return;
                setMessages(payload);
            })
            .catch(() => {
                if (!active) return;
                setMessages([]);
            })
            .finally(() => {
                if (active) setLoadingMessages(false);
            });

        return () => {
            active = false;
        };
    }, [selectedId, refreshTick]);

    async function handleAssumeConversation() {
        if (!selectedConversation) return;
        const response = await fetch(`/api/atendimentos/conversations/${selectedConversation.id}/start`, {
            method: "POST",
            credentials: "include",
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({ message: "Falha ao assumir o atendimento." }));
            setPageError(payload.message ?? "Falha ao assumir o atendimento.");
            return;
        }
        setRefreshTick((value) => value + 1);
    }

    function openSaleModal() {
        setSelectedVehicleId(selectedConversation?.latestCompletedSoldVehicleId ?? "");
        setSelectedSellerUserId(selectedConversation?.assignedUserId ?? "");
        setSaleMessage(null);
        setIsSaleModalOpen(true);
    }

    function closeSaleModal() {
        if (saleSubmitting) return;
        setIsSaleModalOpen(false);
        setSaleMessage(null);
    }

    async function handleConcludeSale() {
        if (!selectedConversation) return;
        if (!selectedVehicleId) {
            setSaleMessage("Selecione o veículo vendido para concluir a venda.");
            return;
        }
        if (!selectedSellerUserId) {
            setSaleMessage("Selecione o vendedor responsável para concluir a venda.");
            return;
        }

        setSaleSubmitting(true);
        setSaleMessage(null);

        try {
            const response = await fetch(`/api/atendimentos/conversations/${selectedConversation.id}/conclude`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    classificationResult: "OBJECTIVE_ACHIEVED",
                    classificationLabel: "Venda concluída",
                    labels: [],
                    saleCompleted: true,
                    soldVehicleId: selectedVehicleId,
                    sellerUserId: selectedSellerUserId,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({ message: "Falha ao concluir a venda." }));
                throw new Error(payload.message ?? "Falha ao concluir a venda.");
            }

            setIsSaleModalOpen(false);
            setRefreshTick((value) => value + 1);
        } catch (cause) {
            setSaleMessage(cause instanceof Error ? cause.message : "Falha ao concluir a venda.");
        } finally {
            setSaleSubmitting(false);
        }
    }

    if (pageLoading && conversations.length === 0) {
        return <SystemPageLoader label="Carregando conversas" description="Sincronizando leads, mensagens e responsáveis..." />;
    }

    return (
        <>
            <div className="grid h-[calc(100vh-50px)] gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <section className="flex h-full flex-col overflow-hidden rounded-[34px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={() => setRefreshTick((value) => value + 1)}
                            className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-black/60 transition hover:border-black/20 hover:text-io-dark"
                        >
                            Atualizar
                        </button>
                    </div>

                    {pageError ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</p> : null}

                    <div className="mt-5 grid flex-1 content-start gap-3 overflow-y-auto pr-1">
                        {conversations.map((conversation) => {
                            const active = conversation.id === selectedId;
                            return (
                                <button
                                    key={conversation.id}
                                    type="button"
                                    onClick={() => setSelectedId(conversation.id)}
                                    className={`rounded-[26px] border px-4 py-4 text-left transition ${active ? "border-2 border-io-purple bg-white text-io-dark shadow-[0_16px_34px_rgba(107,0,227,0.08)]" : "border-black/10 bg-white hover:border-black/20 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${active ? "bg-io-purple text-white" : "bg-io-purple/10 text-io-purple"}`}>
                                                    <SourceIcon platform={conversation.sourcePlatform} />
                                                    {platformLabel(conversation.sourcePlatform)}
                                                </span>
                                                <span className={`text-[11px] ${active ? "text-black/60" : "text-black/45"}`}>{statusLabel(conversation.status)}</span>
                                                {conversation.latestCompletedSaleCompleted ? (
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${active ? "bg-[#f6c453] text-io-dark" : "bg-[#fff4dd] text-[#8a5a00]"}`}>
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        Venda concluída
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-3 truncate text-sm font-semibold">{conversation.displayName || conversation.phone}</p>
                                            <p className={`mt-1 line-clamp-2 text-sm ${active ? "text-black/70" : "text-black/55"}`}>{conversation.lastMessage || "Sem mensagens recentes."}</p>
                                            {conversation.latestCompletedSaleCompleted && conversation.latestCompletedSoldVehicleTitle ? (
                                                <p className={`mt-2 text-xs ${active ? "text-black/60" : "text-black/45"}`}>
                                                    Veículo vendido: {conversation.latestCompletedSoldVehicleTitle}
                                                </p>
                                            ) : null}
                                        </div>
                                        <span className={`text-[11px] ${active ? "text-black/40" : "text-black/45"}`}>{formatDateTime(conversation.lastAt)}</span>
                                    </div>
                                </button>
                            );
                        })}

                        {!conversations.length ? (
                            <p className="rounded-[26px] border border-dashed border-black/10 px-4 py-6 text-sm text-black/45">
                                Assim que chegarem atendimentos pelas integrações de marketplace, eles aparecerão aqui.
                            </p>
                        ) : null}
                    </div>
                </section>

                <section className="flex h-full flex-col overflow-hidden rounded-[34px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                    {selectedConversation ? (
                        <div className="flex h-full flex-col gap-5">
                            <div className="rounded-[28px] border border-black/10 bg-white px-5 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex min-w-0 items-center gap-4">
                                        <div className="grid h-12 w-12 flex-none place-items-center rounded-full bg-io-purple/10 text-lg font-bold uppercase text-io-purple">
                                            {(selectedConversation.displayName || selectedConversation.phone || "?")[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h2 className="truncate text-lg font-bold leading-tight text-io-dark">
                                                    {selectedConversation.displayName || selectedConversation.phone}
                                                </h2>
                                                <span className="text-xs font-medium text-black/40">{selectedConversation.phone}</span>
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-io-purple/10 bg-io-purple/5 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-io-purple">
                                                    <SourceIcon platform={selectedConversation.sourcePlatform} />
                                                    {platformLabel(selectedConversation.sourcePlatform)}
                                                </span>
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-black/40">{statusLabel(selectedConversation.status)}</span>
                                                {selectedConversation.latestCompletedSaleCompleted ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Venda concluída
                                                    </span>
                                                ) : null}
                                                {selectedConversation.assignedUserName && (
                                                    <span className="text-[9px] font-medium italic text-black/35">Atendido por: {selectedConversation.assignedUserName}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-none gap-2">
                                        {selectedConversation.status === "NEW" ? (
                                            <button
                                                type="button"
                                                onClick={handleAssumeConversation}
                                                className="inline-flex h-9 items-center gap-2 rounded-full bg-io-purple px-4 text-xs font-bold text-white shadow-[0_4px_12px_rgba(107,0,227,0.15)] transition hover:brightness-110"
                                            >
                                                <PhoneCall className="h-3.5 w-3.5" />
                                                Assumir
                                            </button>
                                        ) : null}

                                        <button
                                            type="button"
                                            onClick={openSaleModal}
                                            className="inline-flex h-9 items-center gap-2 rounded-full bg-emerald-500 px-4 text-xs font-bold text-white shadow-[0_4px_12px_rgba(16,185,129,0.2)] transition hover:brightness-110"
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Fechar venda
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-1 flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white px-5 py-5 shadow-[0_12px_30px_rgba(0,0,0,0.06)]">
                                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                                    {loadingMessages ? (
                                        <div className="flex h-40 items-center justify-center text-black/45">
                                            <LoaderCircle className="h-5 w-5 animate-spin" />
                                        </div>
                                    ) : (
                                        messages.map((message) => <MessageBubble key={message.id} message={message} />)
                                    )}
                                </div>

                                <div className="mt-4 rounded-[24px] border border-dashed border-black/10 bg-black/[0.03] px-4 py-4 text-sm text-black/50">
                                    O atendimento por WhatsApp foi removido. Esta área agora exibe apenas o histórico recebido pelas integrações de venda.
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid min-h-[520px] place-items-center rounded-[28px] border border-black/10 bg-white text-center shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                            <div className="max-w-md px-6">
                                <MessageSquareText className="mx-auto h-10 w-10 text-black/35" />
                                <h2 className="mt-4 font-display text-3xl font-bold text-io-dark">Central preparada para leads integrados</h2>
                                <p className="mt-3 text-sm leading-7 text-black/50">
                                    Selecione um atendimento para revisar o histórico. Cada lead exibe a plataforma de origem para orientar o contexto comercial.
                                </p>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {isSaleModalOpen && selectedConversation ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
                    <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.22)]">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.28em] text-black/35">Fechamento comercial</p>
                                <h3 className="mt-2 font-display text-3xl font-bold text-io-dark">Registrar venda concluída</h3>
                                <p className="mt-2 text-sm text-black/55">
                                    Escolha o veículo vendido e o vendedor responsável. O sistema vai concluir a venda, esconder o veículo do catálogo público e iniciar a desativação dos anúncios nas integrações conectadas.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeSaleModal}
                                className="rounded-full border border-black/10 px-3 py-2 text-sm font-semibold text-black/60 transition hover:border-black/20 hover:text-io-dark"
                            >
                                Fechar
                            </button>
                        </div>

                        <div className="mt-5 rounded-[24px] bg-black/[0.03] px-4 py-4">
                            <p className="text-sm font-semibold text-io-dark">{selectedConversation.displayName || selectedConversation.phone}</p>
                            <p className="mt-1 text-sm text-black/55">{selectedConversation.phone}</p>
                        </div>

                        <div className="mt-5 grid gap-2">
                            <label className="text-xs uppercase tracking-[0.22em] text-black/40">Veículo vendido</label>
                            <select
                                value={selectedVehicleId}
                                onChange={(event) => setSelectedVehicleId(event.target.value)}
                                className="rounded-[22px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                            >
                                <option value="">Selecione um veículo</option>
                                {saleableVehicles.map((vehicle) => (
                                    <option key={vehicle.id} value={vehicle.id}>
                                        {vehicle.title} • {formatMoney(vehicle.priceCents)} • {statusLabel(vehicle.status)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-4 grid gap-2">
                            <label className="text-xs uppercase tracking-[0.22em] text-black/40">Vendedor responsável</label>
                            <select
                                value={selectedSellerUserId}
                                onChange={(event) => setSelectedSellerUserId(event.target.value)}
                                className="rounded-[22px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                            >
                                <option value="">Selecione um vendedor</option>
                                {teamMembers.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.fullName}{member.teamName ? ` • ${member.teamName}` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {saleMessage ? (
                            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saleMessage}</div>
                        ) : null}

                        {!saleableVehicles.length ? (
                            <div className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-black/50">
                                Não há veículos disponíveis para vincular a esta venda. Cadastre ou reative um veículo no estoque antes de concluir.
                            </div>
                        ) : null}

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeSaleModal}
                                className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-black/60 transition hover:border-black/20 hover:text-io-dark"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConcludeSale}
                                disabled={saleSubmitting || !saleableVehicles.length}
                                className="inline-flex items-center gap-2 rounded-full bg-io-purple px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/20"
                            >
                                {saleSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                Confirmar venda
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
