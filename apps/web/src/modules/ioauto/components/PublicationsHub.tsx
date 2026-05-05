"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers3 } from "lucide-react";
import type { PublicationRecord } from "@/modules/ioauto/types";
import { formatDateTime, statusLabel } from "@/modules/ioauto/formatters";

export function PublicationsHub() {
    const [publications, setPublications] = useState<PublicationRecord[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/ioauto/publications", { cache: "no-store" })
            .then(async (response) => {
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({ message: "Falha ao carregar as publicações." }));
                    throw new Error(payload.message ?? "Falha ao carregar as publicações.");
                }
                return response.json();
            })
            .then((payload: PublicationRecord[]) => {
                setPublications(payload);
                setError(null);
            })
            .catch((cause: Error) => setError(cause.message));
    }, []);

    const grouped = useMemo(() => {
        return publications.reduce<Record<string, PublicationRecord[]>>((accumulator, publication) => {
            const key = publication.status || "UNKNOWN";
            accumulator[key] = accumulator[key] ?? [];
            accumulator[key].push(publication);
            return accumulator;
        }, {});
    }, [publications]);

    if (error) {
        return <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">{error}</div>;
    }

    return (
        <div className="grid gap-6">
            <header>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Módulo Publicações</p>
                <h1 className="mt-2 font-display text-[1.75rem] font-bold leading-tight text-io-dark">Fila de publicações</h1>
                <p className="mt-1.5 text-sm text-black/55">Acompanhe em quais canais cada carro está pronto, publicado ou aguardando configuração.</p>
            </header>

            <section className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-black/55">Status de cada publicação</p>
                    <div className="inline-flex items-center gap-2 rounded-full bg-io-purple px-4 py-2 text-sm font-semibold text-white">
                        <Layers3 className="h-4 w-4" />
                        {publications.length} itens
                    </div>
                </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-3">
                {Object.entries(grouped).map(([status, items]) => (
                    <article key={status} className="rounded-[32px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="font-display text-2xl font-bold text-io-dark">{statusLabel(status)}</h2>
                            <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs text-black/55">{items.length}</span>
                        </div>
                        <div className="mt-4 grid gap-3">
                            {items.map((item) => (
                                <div key={item.id} className="rounded-[24px] bg-black/[0.03] px-4 py-4">
                                    <p className="text-sm font-semibold text-io-dark">{item.vehicleTitle}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-black/45">{item.providerName}</p>
                                    <div className="mt-3 grid gap-1 text-xs text-black/50">
                                        <span>Atualizado em {formatDateTime(item.updatedAt)}</span>
                                        <span>Publicado em {formatDateTime(item.publishedAt)}</span>
                                        {item.lastError ? <span className="text-red-600">{item.lastError}</span> : null}
                                        {item.externalUrl ? (
                                            <a href={item.externalUrl} target="_blank" rel="noreferrer" className="text-io-dark underline">
                                                Abrir anúncio
                                            </a>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </article>
                ))}
                {!publications.length ? (
                    <div className="rounded-[32px] border border-dashed border-black/10 bg-white px-6 py-8 text-sm text-black/45">
                        Nenhuma publicação preparada ainda. Os registros serão criados assim que você vincular veículos aos canais no cadastro unificado.
                    </div>
                ) : null}
            </section>
        </div>
    );
}
