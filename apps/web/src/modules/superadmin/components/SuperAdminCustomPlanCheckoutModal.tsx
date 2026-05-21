"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, LoaderCircle, X } from "lucide-react";

type Props = {
    onClose: () => void;
    onCreated: (message: string) => Promise<void> | void;
};

type FormState = {
    planName: string;
    valueCents: string;
    billingPeriod: string;
    origem: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

type ApiErrorPayload = {
    message?: string;
};

type CustomCheckoutResponse = {
    planId: string;
    planKey: string;
    planName: string;
    checkoutUrl: string;
    checkoutReference?: string | null;
    expiresAt?: string | null;
};

const INITIAL_FORM: FormState = {
    planName: "",
    valueCents: "",
    billingPeriod: "monthly",
    origem: "",
};

function formatCurrencyInput(raw: string) {
    if (raw === "") return "";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(Number(raw) / 100);
}

function normalizeCurrencyDigits(value: string) {
    return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function toDecimalValue(cents: string) {
    return Number((Number(cents || "0") / 100).toFixed(2));
}

function toBrDateTime(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("pt-BR");
}

async function fetchJson<T>(url: string, init?: RequestInit, fallbackMessage = "Falha ao carregar dados.") {
    const response = await fetch(url, { cache: "no-store", ...init });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error((payload as ApiErrorPayload | null)?.message ?? fallbackMessage);
    }
    return payload as T;
}

function validateForm(form: FormState) {
    const errors: FieldErrors = {};

    if (!form.planName.trim()) errors.planName = "Informe o nome do plano.";
    if (form.valueCents === "") errors.valueCents = "Informe o valor do plano.";
    if (!form.billingPeriod.trim()) errors.billingPeriod = "Selecione o ciclo de cobrança.";
    if (!form.origem.trim()) errors.origem = "Informe a origem do checkout.";

    return errors;
}

function hasErrors(errors: FieldErrors) {
    return Object.values(errors).some(Boolean);
}

export function SuperAdminCustomPlanCheckoutModal({ onClose, onCreated }: Props) {
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [result, setResult] = useState<CustomCheckoutResponse | null>(null);

    const expiresAtLabel = useMemo(() => toBrDateTime(result?.expiresAt), [result?.expiresAt]);

    function handleFieldChange<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((current) => ({ ...current, [key]: value }));
        setFieldErrors((current) => ({ ...current, [key]: undefined }));
        setCopied(false);
    }

    async function handleCopyLink() {
        if (!result?.checkoutUrl) return;
        await navigator.clipboard.writeText(result.checkoutUrl);
        setCopied(true);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        setResult(null);
        setCopied(false);

        const validationErrors = validateForm(form);
        if (hasErrors(validationErrors)) {
            setFieldErrors(validationErrors);
            setError("Preencha todos os campos obrigatórios antes de gerar o link.");
            return;
        }

        setSaving(true);
        setFieldErrors({});

        try {
            const payload = {
                value: toDecimalValue(form.valueCents),
                planName: form.planName.trim(),
                billingPeriod: form.billingPeriod,
                origem: form.origem.trim(),
            };

            const response = await fetchJson<CustomCheckoutResponse>(
                "/api/superadmin/plans/custom-checkout",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                },
                "Não foi possível gerar o checkout do plano personalizado.",
            );

            setResult(response);
            const message = `Plano ${response.planName} cadastrado com sucesso e link de pagamento gerado.`;
            setSuccess(message);
            await onCreated(message);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Não foi possível gerar o checkout do plano personalizado.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/45 px-4 py-6" onClick={onClose}>
            <div className="mx-auto flex h-full max-w-3xl items-start justify-center">
                <section
                    className="flex max-h-full w-full flex-col overflow-hidden rounded-[34px] border border-white/15 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-start justify-between gap-4 border-b border-black/8 px-6 py-5 md:px-8">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Plano personalizado</p>
                            <h3 className="mt-2 font-display text-2xl font-bold text-io-dark">Gerar checkout personalizado</h3>
                            <p className="mt-1 text-sm text-black/55">
                                O usuário preencherá os dados da empresa na landing page. Aqui precisamos somente das informações comerciais do checkout.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-black/65 transition hover:border-black/20 hover:text-io-dark"
                            aria-label="Fechar cadastro de plano personalizado"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8">
                        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="grid gap-2 text-sm text-black/65 md:col-span-2">
                                    <span>Nome do plano *</span>
                                    <input
                                        value={form.planName}
                                        onChange={(event) => handleFieldChange("planName", event.target.value)}
                                        placeholder="Ex: Plano Personalizado Premium"
                                        className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple"
                                        required
                                    />
                                    {fieldErrors.planName ? <span className="text-xs text-red-700">{fieldErrors.planName}</span> : null}
                                </label>

                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>Valor do plano *</span>
                                    <input
                                        value={formatCurrencyInput(form.valueCents)}
                                        onChange={(event) => handleFieldChange("valueCents", normalizeCurrencyDigits(event.target.value))}
                                        inputMode="numeric"
                                        placeholder="R$ 0,00"
                                        className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple"
                                        required
                                    />
                                    {fieldErrors.valueCents ? <span className="text-xs text-red-700">{fieldErrors.valueCents}</span> : null}
                                </label>

                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>Ciclo de cobrança *</span>
                                    <select
                                        value={form.billingPeriod}
                                        onChange={(event) => handleFieldChange("billingPeriod", event.target.value)}
                                        className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple"
                                        required
                                    >
                                        <option value="monthly">Mensal</option>
                                        <option value="annual">Anual</option>
                                    </select>
                                    {fieldErrors.billingPeriod ? <span className="text-xs text-red-700">{fieldErrors.billingPeriod}</span> : null}
                                </label>

                                <label className="grid gap-2 text-sm text-black/65 md:col-span-2">
                                    <span>Origem *</span>
                                    <input
                                        value={form.origem}
                                        onChange={(event) => handleFieldChange("origem", event.target.value)}
                                        placeholder="crm-consultor-1"
                                        className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple"
                                        required
                                    />
                                    {fieldErrors.origem ? <span className="text-xs text-red-700">{fieldErrors.origem}</span> : null}
                                </label>
                            </div>

                            {error ? <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                            {success && result ? (
                                <div className="grid gap-3 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                                    <p>{success}</p>
                                    <div className="grid gap-2 rounded-[18px] bg-white/80 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Link de pagamento</p>
                                        <div className="flex flex-col gap-2 md:flex-row">
                                            <input
                                                value={result.checkoutUrl}
                                                readOnly
                                                className="h-11 flex-1 rounded-xl border border-emerald-200 bg-white px-3 text-sm text-io-dark outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void handleCopyLink()}
                                                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300"
                                            >
                                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                {copied ? "Link copiado" : "Copiar link"}
                                            </button>
                                            <a
                                                href={result.checkoutUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-io-dark px-4 text-sm font-semibold text-white"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                                Abrir link
                                            </a>
                                        </div>
                                        <p className="text-xs text-emerald-700/80">
                                            Chave do plano: <span className="font-semibold">{result.planKey}</span>
                                            {expiresAtLabel ? ` • Expira em ${expiresAtLabel}` : ""}
                                        </p>
                                    </div>
                                </div>
                            ) : null}

                            <div className="flex flex-wrap justify-end gap-2">
                                <button type="button" onClick={onClose} className="h-11 rounded-full border border-black/12 px-5 text-sm font-semibold text-io-dark">
                                    {success ? "Fechar" : "Cancelar"}
                                </button>
                                {!success ? (
                                    <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-io-dark px-5 text-sm font-semibold text-white disabled:opacity-60">
                                        {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                                        {saving ? "Gerando..." : "Gerar checkout"}
                                    </button>
                                ) : null}
                            </div>
                        </form>
                    </div>
                </section>
            </div>
        </div>
    );
}
