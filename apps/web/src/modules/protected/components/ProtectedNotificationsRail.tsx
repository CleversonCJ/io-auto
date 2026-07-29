"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { BellRing, LifeBuoy, LogOut, X } from "lucide-react";

type GuidedAnswer = {
    question: string;
    answer: string;
};

type EvidenceAttachment = {
    kind: "image" | "video";
    fileName: string;
    contentType: string;
    dataUrl: string;
};

const GUIDED_QUESTIONS: string[] = [
    "O problema impede você de usar o sistema?",
    "Isso acontece sempre ou às vezes?",
    "Em qual tela ou funcionalidade aconteceu?",
    "Houve alguma mensagem de erro?",
    "Você já tentou atualizar a página ou sair e entrar novamente?",
    "Quantos usuários ou atendimentos estão impactados?",
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 16 * 1024 * 1024;

function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProtectedNotificationsRail() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("BUG");
    const [bugArea, setBugArea] = useState("");
    const [answers, setAnswers] = useState<string[]>(GUIDED_QUESTIONS.map(() => ""));
    const [attachment, setAttachment] = useState<EvidenceAttachment | null>(null);
    const [attachmentInputKey, setAttachmentInputKey] = useState(0);

    const guidedAnswers = useMemo<GuidedAnswer[]>(() => {
        return GUIDED_QUESTIONS.map((question, index) => ({
            question,
            answer: answers[index] ?? "",
        }));
    }, [answers]);

    function resetForm() {
        setTitle("");
        setDescription("");
        setCategory("BUG");
        setBugArea("");
        setAnswers(GUIDED_QUESTIONS.map(() => ""));
        setAttachment(null);
        setAttachmentInputKey((current) => current + 1);
    }

    async function readFileAsDataUrl(file: File) {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(new Error("Não foi possível processar o arquivo anexado."));
            reader.readAsDataURL(file);
        });
    }

    async function handleEvidenceChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0] ?? null;
        if (!file) {
            setAttachment(null);
            return;
        }

        const normalizedContentType = String(file.type ?? "").trim().toLowerCase();
        const isImage = normalizedContentType.startsWith("image/");
        const isVideo = normalizedContentType.startsWith("video/");
        const sizeLimit = isImage ? MAX_IMAGE_BYTES : isVideo ? MAX_VIDEO_BYTES : 0;

        if (!isImage && !isVideo) {
            setAttachment(null);
            setAttachmentInputKey((current) => current + 1);
            setError("Anexe uma imagem ou um vídeo válido para abrir o ticket.");
            return;
        }

        if (file.size > sizeLimit) {
            setAttachment(null);
            setAttachmentInputKey((current) => current + 1);
            setError(`O arquivo anexado excede o limite de ${formatBytes(sizeLimit)}.`);
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            setAttachment({
                kind: isVideo ? "video" : "image",
                fileName: file.name,
                contentType: normalizedContentType,
                dataUrl,
            });
            setError(null);
        } catch (attachmentError) {
            setAttachment(null);
            setAttachmentInputKey((current) => current + 1);
            setError(attachmentError instanceof Error ? attachmentError.message : "Não foi possível processar o arquivo anexado.");
        }
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (loading) return;
        if (!attachment) {
            setError("Anexe uma imagem ou um vídeo do bug antes de abrir o ticket.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch("/api/support/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    category,
                    bugArea: bugArea.trim(),
                    evidenceFileName: attachment.fileName,
                    evidenceContentType: attachment.contentType,
                    evidenceDataUrl: attachment.dataUrl,
                    guidedAnswers: guidedAnswers.map((item) => ({
                        question: item.question,
                        answer: item.answer.trim(),
                    })),
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.message ?? "Não foi possível abrir o ticket.");
            }

            setSuccess("Ticket aberto com sucesso. Nosso time já recebeu a solicitação.");
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Não foi possível abrir o ticket.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <aside className="hidden w-[80px] shrink-0 border-l border-white/10 bg-io-dark xl:flex xl:h-screen xl:flex-col xl:items-center xl:justify-between xl:px-4 xl:py-8">
                <div className="grid gap-3">
                    <button
                        type="button"
                        aria-label="Notificações"
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:border-white/20 hover:bg-io-purple hover:text-white"
                    >
                        <BellRing className="h-5 w-5" strokeWidth={2} />
                    </button>

                    <button
                        type="button"
                        aria-label="Abrir ticket de suporte"
                        onClick={() => {
                            setOpen(true);
                            setError(null);
                            setSuccess(null);
                        }}
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:border-cyan-300/40 hover:bg-cyan-500 hover:text-white"
                    >
                        <LifeBuoy className="h-5 w-5" strokeWidth={2} />
                    </button>
                </div>

                <a
                    href="/api/auth/logout"
                    aria-label="Sair do sistema"
                    className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:border-red-500/30 hover:bg-red-500 hover:text-white"
                >
                    <LogOut className="h-5 w-5" strokeWidth={2} />
                </a>
            </aside>

            {open ? (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
                    <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-black/10 bg-white shadow-xl">
                        <div className="flex items-start justify-between gap-3">
                            <div className="px-6 pt-6">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Suporte IO Auto</p>
                                <h2 className="mt-1 text-2xl font-bold text-io-dark">Abrir ticket</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="mr-6 mt-6 rounded-full border border-black/10 p-2 text-black/55 transition hover:bg-black/5"
                                aria-label="Fechar"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
                            <div className="mt-4 grid gap-3">
                                <input
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    placeholder="Título do ticket"
                                    maxLength={220}
                                    required
                                    className="h-11 rounded-xl border border-black/12 px-3 text-sm"
                                />

                                <textarea
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    placeholder="Explique o problema em detalhes"
                                    required
                                    rows={4}
                                    className="rounded-xl border border-black/12 px-3 py-2 text-sm"
                                />

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="grid gap-1 text-xs text-black/55">
                                        Categoria
                                        <select value={category} onChange={(event) => setCategory(event.target.value)} required className="h-11 rounded-xl border border-black/12 px-3 text-sm text-io-dark">
                                            <option value="BUG">Bug</option>
                                            <option value="QUESTION">Dúvida</option>
                                            <option value="BILLING">Cobrança</option>
                                            <option value="INTEGRATION">Integração</option>
                                            <option value="FEATURE_REQUEST">Solicitação de feature</option>
                                            <option value="OTHER">Outro</option>
                                        </select>
                                    </label>

                                    <label className="grid gap-1 text-xs text-black/55">
                                        área do bug
                                        <input
                                            value={bugArea}
                                            onChange={(event) => setBugArea(event.target.value)}
                                            placeholder="Ex.: Publicações / Financeiro"
                                            maxLength={120}
                                            required
                                            className="h-11 rounded-xl border border-black/12 px-3 text-sm"
                                        />
                                    </label>
                                </div>

                                <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-io-dark">Imagem ou vídeo do bug</p>
                                            <p className="mt-1 text-xs text-black/55">Obrigatório. Aceita imagem até {formatBytes(MAX_IMAGE_BYTES)} ou vídeo até {formatBytes(MAX_VIDEO_BYTES)}.</p>
                                        </div>
                                        {attachment ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAttachment(null);
                                                    setAttachmentInputKey((current) => current + 1);
                                                }}
                                                className="rounded-full border border-black/12 px-3 py-1 text-xs font-semibold text-black/65"
                                            >
                                                Remover arquivo
                                            </button>
                                        ) : null}
                                    </div>

                                    <input
                                        key={attachmentInputKey}
                                        type="file"
                                        accept="image/*,video/*"
                                        required
                                        onChange={(event) => void handleEvidenceChange(event)}
                                        className="mt-3 block w-full rounded-xl border border-black/12 bg-white px-3 py-2 text-sm"
                                    />

                                    {attachment ? (
                                        <div className="mt-3 grid gap-3 rounded-2xl border border-black/10 bg-white p-3">
                                            <div className="text-xs text-black/55">
                                                <p className="font-semibold text-io-dark">{attachment.fileName}</p>
                                                <p className="mt-1">{attachment.kind === "video" ? "Vídeo anexado" : "Imagem anexada"}</p>
                                            </div>
                                            {attachment.kind === "video" ? (
                                                <video src={attachment.dataUrl} controls className="max-h-72 w-full rounded-xl bg-black" />
                                            ) : (
                                                <img src={attachment.dataUrl} alt="Evidência do bug" className="max-h-72 w-full rounded-xl object-contain bg-black/[0.03]" />
                                            )}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                                    <p className="text-sm font-semibold text-io-dark">Perguntas guiadas</p>
                                    <div className="mt-3 grid gap-2">
                                        {GUIDED_QUESTIONS.map((question, index) => (
                                            <label key={question} className="grid gap-1 text-xs text-black/60">
                                                {question}
                                                <input
                                                    value={answers[index] ?? ""}
                                                    onChange={(event) => {
                                                        const next = [...answers];
                                                        next[index] = event.target.value;
                                                        setAnswers(next);
                                                    }}
                                                    required
                                                    className="h-10 rounded-lg border border-black/12 px-3 text-sm"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
                            {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}
                        </div>

                        <div className="flex justify-end gap-2 border-t border-black/8 px-6 py-4">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold text-black/65"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="rounded-full bg-io-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {loading ? "Enviando..." : "Abrir ticket"}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
        </>
    );
}
