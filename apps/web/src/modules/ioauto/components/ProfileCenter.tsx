"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { BadgeCheck, CalendarClock, Camera, ExternalLink, Loader2, Mail, ReceiptText, ShieldCheck, UserCircle2, X } from "lucide-react";
import { SubscriptionCenter } from "@/modules/ioauto/components/SubscriptionCenter";
import type { BillingSnapshot } from "@/modules/ioauto/types";
import { formatDateTime, formatMoney } from "@/modules/ioauto/formatters";

type CurrentUser = {
    userId: string;
    companyId: string;
    companyName?: string | null;
    email: string;
    fullName: string;
    profileImageUrl?: string | null;
    permissionPreset?: string | null;
    modulePermissions?: string[] | null;
    createdAt?: string | null;
    roles: string[];
    teamId?: string | null;
};

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_EDITOR_FRAME_SIZE = 320;
const PROFILE_IMAGE_OUTPUT_SIZE = 512;

type LoadedProfileImage = {
    image: HTMLImageElement;
    objectUrl: string;
    outputType: string;
    naturalWidth: number;
    naturalHeight: number;
};

type ProfileImageEditorState = {
    source: LoadedProfileImage;
    zoom: number;
    positionX: number;
    positionY: number;
};

function getInitials(fullName?: string | null, email?: string | null) {
    const source = (fullName?.trim() || email?.trim() || "IOAuto").split(/\s+/).filter(Boolean);
    const first = source[0]?.[0] ?? "I";
    const second = source[1]?.[0] ?? "O";
    return `${first}${second}`.toUpperCase();
}

function formatPermissionPreset(value?: string | null) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "admin") return "Administrador";
    if (normalized === "default") return "Padrão";
    if (normalized === "custom") return "Personalizado";
    return "Não informado";
}

function formatEntryDate(value?: string | null) {
    if (!value) return "-";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";

    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(parsed);
}

function formatBillingDate(value?: string | null) {
    if (!value) return "-";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split("-").map(Number);
        const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            });
        }
    }

    return formatDateTime(value);
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function resolveCoverLayout(width: number, height: number, frameSize: number, zoom: number, positionX: number, positionY: number) {
    const baseScale = Math.max(frameSize / Math.max(width, 1), frameSize / Math.max(height, 1));
    const scaledWidth = width * baseScale * zoom;
    const scaledHeight = height * baseScale * zoom;
    const maxOffsetX = Math.max(0, scaledWidth - frameSize);
    const maxOffsetY = Math.max(0, scaledHeight - frameSize);
    const left = -maxOffsetX * ((clamp(positionX, -1, 1) + 1) / 2);
    const top = -maxOffsetY * ((clamp(positionY, -1, 1) + 1) / 2);

    return {
        scaledWidth,
        scaledHeight,
        left,
        top,
    };
}

async function loadProfileImage(file: File): Promise<LoadedProfileImage> {
    if (!file.type.startsWith("image/")) {
        throw new Error("Selecione apenas arquivos de imagem.");
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
        throw new Error("A imagem ultrapassa o limite de 5 MB.");
    }

    const objectUrl = URL.createObjectURL(file);
    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const nextImage = new Image();
            nextImage.onload = () => resolve(nextImage);
            nextImage.onerror = () => reject(new Error("Não foi possível processar a imagem selecionada."));
            nextImage.src = objectUrl;
        });

        return {
            image,
            objectUrl,
            outputType: file.type === "image/png" ? "image/png" : "image/jpeg",
            naturalWidth: image.naturalWidth || image.width || 1,
            naturalHeight: image.naturalHeight || image.height || 1,
        };
    } catch (error) {
        URL.revokeObjectURL(objectUrl);
        throw error;
    }
}

function exportAdjustedProfileImage(editor: ProfileImageEditorState) {
    const canvas = document.createElement("canvas");
    canvas.width = PROFILE_IMAGE_OUTPUT_SIZE;
    canvas.height = PROFILE_IMAGE_OUTPUT_SIZE;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem para upload.");

    const layout = resolveCoverLayout(
        editor.source.naturalWidth,
        editor.source.naturalHeight,
        PROFILE_IMAGE_OUTPUT_SIZE,
        editor.zoom,
        editor.positionX,
        editor.positionY,
    );

    context.drawImage(
        editor.source.image,
        layout.left,
        layout.top,
        layout.scaledWidth,
        layout.scaledHeight,
    );

    return canvas.toDataURL(editor.source.outputType, editor.source.outputType === "image/jpeg" ? 0.84 : undefined);
}

export function ProfileCenter() {
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [billing, setBilling] = useState<BillingSnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [profileImageSaving, setProfileImageSaving] = useState(false);
    const [profileImageFeedback, setProfileImageFeedback] = useState<string | null>(null);
    const [profileImageEditor, setProfileImageEditor] = useState<ProfileImageEditorState | null>(null);
    const avatarInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        let active = true;

        Promise.all([
            fetch("/api/auth/me", { cache: "no-store" }),
            fetch("/api/ioauto/billing", { cache: "no-store" }),
        ])
            .then(async ([meResponse, billingResponse]) => {
                if (!meResponse.ok) {
                    const payload = await meResponse.json().catch(() => ({ message: "Falha ao carregar o perfil." }));
                    throw new Error(payload.message ?? "Falha ao carregar o perfil.");
                }

                const mePayload = (await meResponse.json()) as CurrentUser;
                const billingPayload = billingResponse.ok
                    ? (await billingResponse.json()) as BillingSnapshot
                    : null;

                return { mePayload, billingPayload };
            })
            .then(({ mePayload, billingPayload }) => {
                if (!active) return;
                setUser(mePayload);
                setBilling(billingPayload);
                setError(null);
            })
            .catch((cause: Error) => {
                if (!active) return;
                setError(cause.message);
            });

        return () => {
            active = false;
        };
    }, []);

    const permissionList = useMemo(() => {
        return (user?.modulePermissions ?? []).filter((item) => item.trim().length > 0);
    }, [user?.modulePermissions]);

    const enabledModules = useMemo(() => {
        return (billing?.enabledModules ?? []).filter((item) => item.trim().length > 0);
    }, [billing?.enabledModules]);

    const isSuperAdmin = useMemo(() => {
        return (user?.roles ?? []).some((role) => role.toUpperCase() === "SUPERADMIN");
    }, [user?.roles]);

    const canSyncCompanyLogo = useMemo(() => {
        return (user?.roles ?? []).some((role) => {
            const normalized = role.toUpperCase();
            return normalized === "ADMIN" || normalized === "SUPERADMIN";
        });
    }, [user?.roles]);

    const editorPreviewLayout = useMemo(() => {
        if (!profileImageEditor) return null;
        return resolveCoverLayout(
            profileImageEditor.source.naturalWidth,
            profileImageEditor.source.naturalHeight,
            PROFILE_EDITOR_FRAME_SIZE,
            profileImageEditor.zoom,
            profileImageEditor.positionX,
            profileImageEditor.positionY,
        );
    }, [profileImageEditor]);

    useEffect(() => {
        const objectUrl = profileImageEditor?.source.objectUrl;
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [profileImageEditor?.source.objectUrl]);

    async function handleProfileImageSelected(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0] ?? null;
        event.target.value = "";
        if (!file || !user) return;

        try {
            setProfileImageFeedback(null);
            const source = await loadProfileImage(file);
            setProfileImageEditor((previous) => {
                if (previous?.source.objectUrl) {
                    URL.revokeObjectURL(previous.source.objectUrl);
                }
                return {
                    source,
                    zoom: 1,
                    positionX: 0,
                    positionY: 0,
                };
            });
        } catch (cause) {
            setProfileImageFeedback(cause instanceof Error ? cause.message : "Não foi possível carregar a imagem selecionada.");
        }
    }

    function closeProfileImageEditor() {
        setProfileImageEditor((previous) => {
            if (previous?.source.objectUrl) {
                URL.revokeObjectURL(previous.source.objectUrl);
            }
            return null;
        });
    }

    async function handleProfileImageSave() {
        if (!profileImageEditor || !user) return;

        setProfileImageSaving(true);
        setProfileImageFeedback(null);

        try {
            const profileImageUrl = exportAdjustedProfileImage(profileImageEditor);
            const response = await fetch("/api/auth/me/profile-image", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileImageUrl,
                    syncCompanyLogo: canSyncCompanyLogo,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.message ?? "Não foi possível atualizar a foto de perfil.");
            }

            setUser((previous) => (previous ? { ...previous, profileImageUrl } : previous));
            setProfileImageFeedback(canSyncCompanyLogo
                ? "Foto atualizada com sucesso. A logo da empresa também foi atualizada."
                : "Foto atualizada com sucesso.");
            closeProfileImageEditor();
        } catch (cause) {
            setProfileImageFeedback(cause instanceof Error ? cause.message : "Não foi possível atualizar a foto de perfil.");
        } finally {
            setProfileImageSaving(false);
        }
    }

    if (error) {
        return <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">{error}</div>;
    }

    return (
        <>
        <div className="grid gap-6">
            <section className="rounded-[36px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-center gap-4">
                        {user?.profileImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={user.profileImageUrl} alt={user.fullName ?? "Usuário"} className="h-20 w-20 rounded-[28px] object-cover" />
                        ) : (
                            <div className="grid h-20 w-20 place-items-center rounded-[28px] bg-io-dark text-xl font-bold text-white">
                                {getInitials(user?.fullName, user?.email)}
                            </div>
                        )}

                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    disabled={profileImageSaving}
                                    className="inline-flex h-9 items-center gap-2 rounded-full border border-black/12 px-4 text-xs font-semibold text-io-dark transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {profileImageSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                                    {profileImageSaving ? "Salvando foto..." : "Trocar foto de perfil"}
                                </button>
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) => void handleProfileImageSelected(event)}
                                    className="hidden"
                                />
                                {canSyncCompanyLogo ? (
                                    <span className="text-xs text-black/45">Ao alterar sua foto, a logo da empresa também será atualizada.</span>
                                ) : null}
                            </div>
                            {profileImageFeedback ? <p className="mt-2 text-xs font-semibold text-emerald-700">{profileImageFeedback}</p> : null}
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-1">
                        <ProfileStat
                            icon={<ShieldCheck className="h-4 w-4" />}
                            label="Perfil de acesso"
                            value={formatPermissionPreset(user?.permissionPreset)}
                        />
                        {billing?.pendingProrationCreditCents ? (
                            <ProfileStat
                                icon={<BadgeCheck className="h-4 w-4" />}
                                label="Crédito nas próximas cobranças"
                                value={`${formatMoney(billing.pendingProrationCreditCents, "BRL")} - ${formatDateTime(billing.pendingProrationCreditUpdatedAt)}`}
                            />
                        ) : null}
                    </div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr] xl:items-stretch">
                <article className="h-full rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-io-purple text-white">
                            <UserCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-display text-3xl font-bold text-io-dark">Informações da conta</h2>
                            <p className="mt-1 text-sm text-black/55">Resumo do usuário autenticado e dos acessos disponíveis na operação.</p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <InfoCard label="Nome" value={user?.fullName ?? "-"} />
                        <InfoCard label="E-mail" value={user?.email ?? "-"} />
                        <InfoCard label="Data de entrada" value={formatEntryDate(user?.createdAt)} />
                        <InfoCard label="Empresa vinculada" value={user?.companyName ?? "-"} />
                        {billing?.pendingProrationCreditCents ? (
                            <InfoCard
                                label="Crédito da assinatura"
                                value={`${formatMoney(billing.pendingProrationCreditCents, "BRL")} - saldo a abater`}
                            />
                        ) : null}
                        {billing?.pendingProrationCreditCents ? (
                            <InfoCard
                                label="Observação do crédito"
                                value={billing.pendingProrationCreditNote || "Abatimento automático nas próximas cobranças."}
                            />
                        ) : null}
                    </div>
                </article>

                <aside className="flex h-full min-h-[320px] flex-col rounded-[34px] border border-black/10 bg-io-dark p-6 text-white shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
                    <p className="text-xs uppercase tracking-[0.28em] text-white/45">Permissões</p>
                    <h2 className="mt-3 font-display text-3xl font-bold">Acesso atual</h2>
                    <p className="mt-4 text-sm leading-7 text-white/70">
                        Estas informações refletem o perfil carregado na sessão atual e ajudam a conferir o escopo de operação da sua conta.
                    </p>

                    <div className="mt-6 grid flex-1 content-start gap-3 rounded-[28px] border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center gap-2 text-sm text-white/80">
                            <Mail className="h-4 w-4" />
                            <span>{user?.email ?? "Sem e-mail disponível"}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(user?.roles ?? []).length ? (
                                user!.roles.map((role) => (
                                    <span key={role} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                                        <BadgeCheck className="h-3.5 w-3.5" />
                                        {role}
                                    </span>
                                ))
                            ) : (
                                <span className="text-sm text-white/60">Nenhuma role vinculada.</span>
                            )}
                        </div>
                        <div className="grid gap-2 pt-2">
                            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Módulos habilitados na conta</p>
                            {enabledModules.length ? (
                                <div className="flex flex-wrap gap-2">
                                    {enabledModules.map((moduleName) => (
                                        <span key={moduleName} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/75">
                                            {moduleName}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-sm text-white/60">Não foi possível carregar os módulos do plano.</span>
                            )}
                        </div>
                        {permissionList.length ? (
                            <div className="grid gap-2 pt-2">
                                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Permissões customizadas do usuário</p>
                                <div className="flex flex-wrap gap-2">
                                    {permissionList.map((permission) => (
                                        <span key={permission} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/75">
                                            {permission}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </aside>
            </section>

            {!isSuperAdmin ? (
            <section id="faturas" className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0f766e] text-white">
                        <ReceiptText className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="font-display text-3xl font-bold text-io-dark">Faturas da assinatura</h2>
                        <p className="mt-1 text-sm text-black/55">Acompanhe a próxima cobrança da empresa e as últimas faturas já pagas.</p>
                    </div>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                    <article className="rounded-[28px] border border-black/10 bg-black/[0.02] p-5">
                        <div className="flex items-center gap-3">
                            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0f766e]/10 text-[#0f766e]">
                                <CalendarClock className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Próxima fatura</p>
                                <p className="mt-1 text-sm text-black/55">Valor, vencimento e plano da próxima cobrança prevista.</p>
                            </div>
                        </div>

                        {billing?.nextInvoice ? (
                            <div className="mt-5 grid gap-4">
                                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                                    <p className="text-lg font-bold text-io-dark">{billing.nextInvoice.title || billing.planName || "Plano atual"}</p>
                                    <p className="mt-2 text-3xl font-bold text-emerald-700">
                                        {formatMoney(billing.nextInvoice.amountCents, billing.nextInvoice.currency || billing.currency || "BRL")}
                                    </p>
                                    <p className="mt-2 text-sm text-emerald-900/80">
                                        Vencimento em {formatBillingDate(billing.nextInvoice.dueDate)}
                                    </p>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <InfoCard label="Plano" value={billing.nextInvoice.title || billing.planName || "-"} />
                                    <InfoCard label="Vencimento" value={formatBillingDate(billing.nextInvoice.dueDate)} />
                                </div>

                                {billing.nextInvoice.invoiceUrl ? (
                                    <a
                                        href={billing.nextInvoice.invoiceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Abrir próxima fatura
                                    </a>
                                ) : null}
                            </div>
                        ) : (
                            <div className="mt-5 rounded-[24px] border border-dashed border-black/12 bg-black/[0.02] px-4 py-5 text-sm leading-6 text-black/60">
                                Não há uma próxima fatura disponível para esta empresa no momento.
                            </div>
                        )}
                    </article>

                    <article className="rounded-[28px] border border-black/10 bg-black/[0.02] p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Faturas pagas</p>
                        <h3 className="mt-2 text-2xl font-bold text-io-dark">Histórico recente</h3>
                        <p className="mt-1 text-sm text-black/55">Últimas cobranças confirmadas com valor, vencimento e plano vinculado.</p>

                        {billing?.paidInvoices?.length ? (
                            <div className="mt-5 grid gap-3">
                                {billing.paidInvoices.map((invoice) => (
                                    <div key={invoice.paymentId} className="rounded-[22px] border border-black/10 bg-white px-4 py-4">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-io-dark">{invoice.title || billing.planName || "Plano"}</p>
                                                <p className="mt-1 text-sm text-black/55">Vencimento: {formatBillingDate(invoice.dueDate)}</p>
                                                {invoice.paidAt ? (
                                                    <p className="mt-1 text-xs text-black/45">Pago em {formatDateTime(invoice.paidAt)}</p>
                                                ) : null}
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <p className="text-right text-lg font-bold text-emerald-700">
                                                    {formatMoney(invoice.amountCents, invoice.currency || billing.currency || "BRL")}
                                                </p>
                                                {invoice.invoiceUrl ? (
                                                    <a
                                                        href={invoice.invoiceUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-black/70 transition hover:bg-black/[0.03]"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                        Ver fatura
                                                    </a>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-5 rounded-[24px] border border-dashed border-black/12 bg-black/[0.02] px-4 py-5 text-sm leading-6 text-black/60">
                                Ainda não há faturas pagas registradas para exibir aqui.
                            </div>
                        )}
                    </article>
                </div>
            </section>
            ) : null}

            {!isSuperAdmin ? <SubscriptionCenter
                title="Assinatura e cobrança"
                description="Todos os dados financeiros e de plano do tenant ficam concentrados no perfil para facilitar a gestão da conta."
                currentUserRoles={user?.roles}
                onBillingChange={setBilling}
            /> : null}
        </div>

        {profileImageEditor && editorPreviewLayout ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
                <div className="w-full max-w-3xl rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_32px_80px_rgba(0,0,0,0.28)]">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Ajustar foto</p>
                            <h2 className="mt-2 font-display text-3xl font-bold text-io-dark">Posicione sua imagem antes de salvar</h2>
                            <p className="mt-2 text-sm leading-6 text-black/55">
                                Ajuste o enquadramento para evitar cortes indesejados na foto de perfil.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={closeProfileImageEditor}
                            disabled={profileImageSaving}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-black/65 transition hover:border-black/20 hover:text-io-dark disabled:opacity-60"
                            aria-label="Fechar ajuste da foto"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr] lg:items-start">
                        <div className="rounded-[28px] border border-black/10 bg-black/[0.02] p-5">
                            <div
                                className="relative mx-auto overflow-hidden rounded-[28px] border border-black/10 bg-black/5"
                                style={{ width: PROFILE_EDITOR_FRAME_SIZE, height: PROFILE_EDITOR_FRAME_SIZE }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={profileImageEditor.source.objectUrl}
                                    alt="Prévia da foto de perfil"
                                    className="pointer-events-none absolute max-w-none select-none"
                                    style={{
                                        width: editorPreviewLayout.scaledWidth,
                                        height: editorPreviewLayout.scaledHeight,
                                        left: editorPreviewLayout.left,
                                        top: editorPreviewLayout.top,
                                    }}
                                />
                            </div>
                            <p className="mt-4 text-center text-xs text-black/45">
                                Esta prévia mostra exatamente como a foto ficará no perfil.
                            </p>
                        </div>

                        <div className="grid gap-5">
                            <label className="grid gap-2">
                                <span className="text-sm font-semibold text-io-dark">Zoom</span>
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.01}
                                    value={profileImageEditor.zoom}
                                    onChange={(event) => setProfileImageEditor((previous) => previous ? ({ ...previous, zoom: Number(event.target.value) }) : previous)}
                                />
                                <span className="text-xs text-black/50">{Math.round(profileImageEditor.zoom * 100)}%</span>
                            </label>

                            <label className="grid gap-2">
                                <span className="text-sm font-semibold text-io-dark">Posição horizontal</span>
                                <input
                                    type="range"
                                    min={-1}
                                    max={1}
                                    step={0.01}
                                    value={profileImageEditor.positionX}
                                    onChange={(event) => setProfileImageEditor((previous) => previous ? ({ ...previous, positionX: Number(event.target.value) }) : previous)}
                                />
                            </label>

                            <label className="grid gap-2">
                                <span className="text-sm font-semibold text-io-dark">Posição vertical</span>
                                <input
                                    type="range"
                                    min={-1}
                                    max={1}
                                    step={0.01}
                                    value={profileImageEditor.positionY}
                                    onChange={(event) => setProfileImageEditor((previous) => previous ? ({ ...previous, positionY: Number(event.target.value) }) : previous)}
                                />
                            </label>

                            <div className="flex flex-wrap gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setProfileImageEditor((previous) => previous ? ({ ...previous, zoom: 1, positionX: 0, positionY: 0 }) : previous)}
                                    disabled={profileImageSaving}
                                    className="inline-flex h-11 items-center justify-center rounded-full border border-black/12 px-5 text-sm font-semibold text-io-dark disabled:opacity-60"
                                >
                                    Reposicionar
                                </button>
                                <button
                                    type="button"
                                    onClick={closeProfileImageEditor}
                                    disabled={profileImageSaving}
                                    className="inline-flex h-11 items-center justify-center rounded-full border border-black/12 px-5 text-sm font-semibold text-io-dark disabled:opacity-60"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleProfileImageSave()}
                                    disabled={profileImageSaving}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-io-dark px-5 text-sm font-semibold text-white disabled:opacity-60"
                                >
                                    {profileImageSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    {profileImageSaving ? "Salvando..." : "Salvar foto"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ) : null}
        </>
    );
}

function ProfileStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="rounded-[24px] border border-black/10 bg-black/[0.02] px-4 py-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-black/40">
                {icon}
                <span>{label}</span>
            </div>
            <p className="mt-3 break-all text-sm font-semibold text-io-dark">{value}</p>
        </div>
    );
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-[24px] border border-black/10 bg-black/[0.02] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-black/40">{label}</p>
            <p className="mt-3 break-all text-sm font-semibold text-io-dark">{value}</p>
        </div>
    );
}
