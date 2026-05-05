"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { InlineToggle } from "@/modules/ai-supervisors/components/SupervisorUi";
import { formatFollowUpDelay } from "@/modules/crm/followUps";
import type { CrmFollowUp, CrmFollowUpDelayUnit, CrmFollowUpNotification } from "@/modules/crm/storage";

type CrmFollowUpsManagerProps = {
    isOpen: boolean;
    followUps: CrmFollowUp[];
    notifications: CrmFollowUpNotification[];
    onClose: () => void;
    onSave: (nextFollowUps: CrmFollowUp[]) => void;
};

type FollowUpDraft = {
    id: string | null;
    title: string;
    message: string;
    delayAmount: string;
    delayUnit: CrmFollowUpDelayUnit;
    isActive: boolean;
};

const DELAY_UNIT_OPTIONS: Array<{ value: CrmFollowUpDelayUnit; label: string }> = [
    { value: "minutes", label: "Minutos" },
    { value: "hours", label: "Horas" },
    { value: "days", label: "Dias" },
];

const EMPTY_DRAFT: FollowUpDraft = {
    id: null,
    title: "",
    message: "",
    delayAmount: "30",
    delayUnit: "minutes",
    isActive: true,
};

function toDraft(rule?: CrmFollowUp | null): FollowUpDraft {
    if (!rule) return EMPTY_DRAFT;
    return {
        id: rule.id,
        title: rule.title,
        message: rule.message,
        delayAmount: String(rule.delayAmount),
        delayUnit: rule.delayUnit,
        isActive: rule.isActive,
    };
}

export function CrmFollowUpsManager({
    isOpen,
    followUps,
    notifications,
    onClose,
    onSave,
}: CrmFollowUpsManagerProps) {
    const [draft, setDraft] = useState<FollowUpDraft>(EMPTY_DRAFT);
    const [error, setError] = useState<string | null>(null);

    const activeFollowUpsCount = useMemo(() => followUps.filter((item) => item.isActive).length, [followUps]);
    const pendingNotificationsByRule = useMemo(() => {
        const map = new Map<string, number>();
        for (const notification of notifications) {
            if (notification.resolvedAt) continue;
            map.set(notification.followUpId, (map.get(notification.followUpId) ?? 0) + 1);
        }
        return map;
    }, [notifications]);

    useEffect(() => {
        if (!isOpen) return;
        setDraft(EMPTY_DRAFT);
        setError(null);
    }, [isOpen]);

    if (!isOpen) return null;

    function resetDraft() {
        setDraft(EMPTY_DRAFT);
        setError(null);
    }

    function editRule(rule: CrmFollowUp) {
        setDraft(toDraft(rule));
        setError(null);
    }

    function validateDraft() {
        const title = draft.title.trim();
        const message = draft.message.trim();
        const delayAmount = Math.round(Number(draft.delayAmount));

        if (!title) return "Informe o título do follow-up.";
        if (!message) return "Informe a mensagem de aviso.";
        if (!Number.isFinite(delayAmount) || delayAmount <= 0) return "Informe um tempo válido maior que zero.";
        return null;
    }

    function handleSaveDraft() {
        const validationError = validateDraft();
        if (validationError) {
            setError(validationError);
            return;
        }

        const now = new Date().toISOString();
        const normalizedRule: CrmFollowUp = {
            id: draft.id ?? `crm_follow_up_${Date.now()}`,
            title: draft.title.trim(),
            message: draft.message.trim(),
            delayAmount: Math.max(1, Math.round(Number(draft.delayAmount))),
            delayUnit: draft.delayUnit,
            isActive: draft.isActive,
            createdAt: draft.id
                ? followUps.find((item) => item.id === draft.id)?.createdAt ?? now
                : now,
            updatedAt: now,
        };

        const nextFollowUps = draft.id
            ? followUps.map((item) => (item.id === draft.id ? normalizedRule : item))
            : [normalizedRule, ...followUps];

        onSave(nextFollowUps);
        setDraft(toDraft(normalizedRule));
        setError(null);
    }

    function handleToggleRule(rule: CrmFollowUp, isActive: boolean) {
        const now = new Date().toISOString();
        onSave(
            followUps.map((item) =>
                item.id === rule.id
                    ? {
                        ...item,
                        isActive,
                        updatedAt: now,
                    }
                    : item
            )
        );
        if (draft.id === rule.id) {
            setDraft((current) => ({ ...current, isActive }));
        }
    }

    function handleDeleteRule(ruleId: string) {
        onSave(followUps.filter((item) => item.id !== ruleId));
        if (draft.id === ruleId) resetDraft();
    }

    const totalPendingNotifications = Array.from(pendingNotificationsByRule.values()).reduce((sum, value) => sum + value, 0);

    return (
        <div className="fixed inset-0 z-[75] grid place-items-center bg-black/45 p-4">
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/15 bg-io-light shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
                <div className="flex items-start justify-between gap-4 border-b border-black/10 bg-white px-6 py-5">
                    <div>
                        <h2 className="text-2xl font-semibold text-io-dark">Follow ups</h2>
                        <p className="mt-1 text-sm text-black/60">
                            Crie regras para avisar o responsável quando um lead ficar sem resposta ou sem retornar por um tempo definido.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 text-black/60 transition hover:bg-black/5"
                        aria-label="Fechar modal de follow ups"
                        title="Fechar"
                    >
                        <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
                    <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                        <div className="mb-5 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-io-purple px-3 py-1 text-xs font-semibold text-white">{activeFollowUpsCount} ativos</span>
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{totalPendingNotifications} alertas pendentes</span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-io-dark">Título do follow-up</label>
                                <input
                                    value={draft.title}
                                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                                    placeholder="Ex.: Recontato comercial"
                                    className="h-11 w-full rounded-2xl border border-black/12 px-4 text-sm text-io-dark outline-none focus:border-black/35"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-io-dark">Mensagem de aviso</label>
                                <textarea
                                    value={draft.message}
                                    onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))}
                                    rows={4}
                                    placeholder="Ex.: Este lead está aguardando retorno. Tente retomar o contato agora."
                                    className="w-full rounded-2xl border border-black/12 px-4 py-3 text-sm text-io-dark outline-none focus:border-black/35"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-io-dark">Tempo sem resposta</label>
                                <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                                    <input
                                        type="number"
                                        min="1"
                                        value={draft.delayAmount}
                                        onChange={(event) => setDraft((current) => ({ ...current, delayAmount: event.target.value }))}
                                        className="h-11 rounded-2xl border border-black/12 px-4 text-sm text-io-dark outline-none focus:border-black/35"
                                    />
                                    <select
                                        value={draft.delayUnit}
                                        onChange={(event) => setDraft((current) => ({ ...current, delayUnit: event.target.value as CrmFollowUpDelayUnit }))}
                                        className="h-11 rounded-2xl border border-black/12 px-4 text-sm text-io-dark outline-none focus:border-black/35"
                                    >
                                        {DELAY_UNIT_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <InlineToggle
                                checked={draft.isActive}
                                onChange={(checked) => setDraft((current) => ({ ...current, isActive: checked }))}
                                label="Ativar follow up"
                                description="Quando ativo, a regra entra automaticamente no monitoramento dos contatos."
                            />

                            {error ? <p className="text-sm text-red-600">{error}</p> : null}

                            <div className="flex flex-wrap items-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={handleSaveDraft}
                                    className="rounded-full bg-io-purple px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85"
                                >
                                    {draft.id ? "Salvar alterações" : "Criar follow-up"}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetDraft}
                                    className="rounded-2xl border border-black/15 px-5 py-2.5 text-sm font-semibold text-io-dark transition hover:bg-black/5"
                                >
                                    Novo follow-up
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-io-dark">Regras cadastradas</h3>
                                <p className="mt-1 text-sm text-black/55">Use a lista ao lado para editar rapidamente o fluxo de follow-up.</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {followUps.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-4 py-8 text-center text-sm text-black/55">
                                    Nenhum follow-up cadastrado ainda.
                                </div>
                            ) : (
                                followUps.map((rule) => {
                                    const pendingCount = pendingNotificationsByRule.get(rule.id) ?? 0;
                                    const isSelected = draft.id === rule.id;
                                    return (
                                        <div
                                            key={rule.id}
                                            className={`rounded-[24px] border p-4 transition ${isSelected ? "border-black/20 bg-io-light" : "border-black/10 bg-white"}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="truncate text-sm font-semibold text-io-dark">{rule.title}</p>
                                                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${rule.isActive ? "bg-emerald-100 text-emerald-800" : "bg-black/10 text-black/55"}`}>
                                                            {rule.isActive ? "Ativo" : "Inativo"}
                                                        </span>
                                                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                                                            {pendingCount} alerta{pendingCount === 1 ? "" : "s"}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 text-sm text-black/60">{rule.message}</p>
                                                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-black/45">
                                                        Aciona em {formatFollowUpDelay(rule.delayAmount, rule.delayUnit)}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => editRule(rule)}
                                                    className="rounded-xl border border-black/15 px-3 py-1.5 text-xs font-semibold text-io-dark transition hover:bg-black/5"
                                                >
                                                    Editar
                                                </button>
                                            </div>

                                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleRule(rule, !rule.isActive)}
                                                    className={`rounded-full px-3 py-2 text-xs font-semibold ${rule.isActive ? "bg-black/5 text-black/70" : "bg-io-light text-black/60"}`}
                                                >
                                                    {rule.isActive ? "Desativar" : "Ativar"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteRule(rule.id)}
                                                    className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
