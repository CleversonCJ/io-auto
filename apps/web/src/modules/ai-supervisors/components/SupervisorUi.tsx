"use client";

import type { ReactNode } from "react";
import { SystemPageLoader } from "@/modules/shared/components/SystemPageLoader";

export type ToastType = "success" | "error" | "info";
export type ToastMessage = {
    id: number;
    message: string;
    type: ToastType;
};

type BreadcrumbItem = {
    label: string;
    href?: string;
};

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

export function SupervisorBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
    return (
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-black/55">
            {items.map((item, index) => (
                <span key={`${item.label}-${index}`} className="flex items-center gap-2">
                    {index > 0 && <span aria-hidden="true">/</span>}
                    {item.href ? (
                        <a href={item.href} className="transition hover:text-io-purple">
                            {item.label}
                        </a>
                    ) : (
                        <span className="font-medium text-black/75">{item.label}</span>
                    )}
                </span>
            ))}
        </nav>
    );
}

export function PageShell({
    actions,
    children,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="space-y-5">
            {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
            {children}
        </section>
    );
}

export function SectionCard({
    title,
    description,
    actions,
    children,
    className,
}: {
    title?: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn("rounded-2xl border border-black/10 bg-white p-5 shadow-soft", className)}>
            {(title || description || actions) ? (
                <header className="mb-4 flex flex-col gap-3 border-b border-black/5 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        {title ? <h2 className="text-lg font-semibold text-io-dark">{title}</h2> : null}
                        {description ? <p className="mt-1 text-sm text-black/60">{description}</p> : null}
                    </div>
                    {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
                </header>
            ) : null}
            {children}
        </section>
    );
}

export function FieldLabel({
    htmlFor,
    label,
    description,
    required,
    trailing,
}: {
    htmlFor?: string;
    label: string;
    description?: string;
    required?: boolean;
    trailing?: ReactNode;
}) {
    return (
        <div className="mb-2 flex items-start justify-between gap-3">
            <div>
                <label htmlFor={htmlFor} className="block text-sm font-medium text-io-dark">
                    {label} {required ? <span className="text-red-600">*</span> : null}
                </label>
                {description ? <p className="mt-1 text-xs text-black/55">{description}</p> : null}
            </div>
            {trailing ? <div className="shrink-0 text-xs text-black/45">{trailing}</div> : null}
        </div>
    );
}

export function FieldError({ message }: { message?: string | null }) {
    if (!message) return null;
    return <p className="mt-2 text-sm text-red-600">{message}</p>;
}

export function StatusPill({
    children,
    tone = "default",
}: {
    children: ReactNode;
    tone?: "success" | "warning" | "danger" | "default" | "info";
}) {
    const toneClassName =
        tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : tone === "danger"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : tone === "info"
                        ? "border-io-purple/20 bg-io-purple/10 text-io-purple"
                        : "border-black/10 bg-black/5 text-black/65";

    return (
        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", toneClassName)}>
            {children}
        </span>
    );
}

export function InlineToggle({
    checked,
    onChange,
    label,
    description,
    disabled,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                checked ? "border-io-purple/25 bg-io-purple/10" : "border-black/10 bg-white",
                disabled && "cursor-not-allowed opacity-60",
            )}
        >
            <span className="pr-4">
                <span className="block text-sm font-medium text-io-dark">{label}</span>
                {description ? <span className="mt-1 block text-xs text-black/55">{description}</span> : null}
            </span>
            <span
                aria-hidden="true"
                className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 rounded-full transition",
                    checked ? "bg-io-purple" : "bg-black/20",
                )}
            >
                <span
                    className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                        checked ? "left-[1.4rem]" : "left-0.5",
                    )}
                />
            </span>
        </button>
    );
}

export function ModalFrame({
    title,
    description,
    onClose,
    children,
}: {
    title: string;
    description?: string;
    onClose: () => void;
    children: ReactNode;
}) {
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4 py-6">
            <div className="w-full max-w-xl rounded-2xl border border-black/10 bg-white p-5 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-io-dark">{title}</h2>
                        {description ? <p className="mt-1 text-sm text-black/60">{description}</p> : null}
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-black/55 transition hover:bg-black/5 hover:text-io-dark">
                        Fechar
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function ToastStack({
    items,
    onDismiss,
}: {
    items: ToastMessage[];
    onDismiss: (id: number) => void;
}) {
    if (!items.length) return null;

    return (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
            {items.map((toast) => (
                <div
                    key={toast.id}
                    className={cn(
                        "pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-soft",
                        toast.type === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : toast.type === "error"
                                ? "border-red-200 bg-red-50 text-red-800"
                                : "border-io-purple/20 bg-white text-io-dark",
                    )}
                >
                    <div className="flex items-start justify-between gap-3">
                        <p>{toast.message}</p>
                        <button type="button" onClick={() => onDismiss(toast.id)} className="text-xs opacity-70 transition hover:opacity-100">
                            Fechar
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function EmptyState({
    title,
    description,
    action,
}: {
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center shadow-soft">
            <h3 className="text-lg font-semibold text-io-dark">{title}</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-black/60">{description}</p>
            {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
        </div>
    );
}

export function ErrorState({
    message,
    onRetry,
}: {
    message: string;
    onRetry?: () => void;
}) {
    return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-soft">
            <p>{message}</p>
            {onRetry ? (
                <button type="button" onClick={onRetry} className="mt-3 rounded-xl border border-red-200 bg-white px-3 py-2 font-semibold text-red-700 transition hover:bg-red-100">
                    Tentar novamente
                </button>
            ) : null}
        </div>
    );
}

export function LoadingState({ label }: { label: string }) {
    return <SystemPageLoader label={label} compact className="rounded-2xl border border-black/10 bg-white shadow-soft" />;
}
