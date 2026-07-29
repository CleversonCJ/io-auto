"use client";

import { useState } from "react";
import { FieldError } from "./SupervisorUi";

type OptionsChipsInputProps = {
    value: string[];
    onChange: (next: string[]) => void;
    disabled?: boolean;
    maxItems?: number;
    placeholder?: string;
    ariaLabel?: string;
    error?: string | null;
};

function normalizeOption(value: string) {
    return value.replace(/\s+/g, " ").trim();
}

export function OptionsChipsInput({
    value,
    onChange,
    disabled,
    maxItems = 10,
    placeholder = "Digite uma opção e pressione Enter",
    ariaLabel,
    error,
}: OptionsChipsInputProps) {
    const [draft, setDraft] = useState("");

    function commitDraft() {
        const normalized = normalizeOption(draft);
        if (!normalized) {
            setDraft("");
            return;
        }
        if (normalized.length < 2 || normalized.length > 30) return;
        if (value.includes(normalized) || value.length >= maxItems) {
            setDraft("");
            return;
        }
        onChange([...value, normalized]);
        setDraft("");
    }

    function removeOption(item: string) {
        onChange(value.filter((current) => current !== item));
    }

    return (
        <div>
            <div className="rounded-2xl border border-black/10 bg-white px-3 py-3">
                <div className="flex flex-wrap gap-2">
                    {value.map((item) => (
                        <span key={item} className="inline-flex items-center gap-2 rounded-full border border-io-purple/20 bg-io-purple/10 px-3 py-1 text-sm font-medium text-io-purple">
                            {item}
                            <button
                                type="button"
                                onClick={() => removeOption(item)}
                                disabled={disabled}
                                className="rounded-full text-xs opacity-70 transition hover:opacity-100 disabled:cursor-not-allowed"
                                aria-label={`Remover opção ${item}`}
                            >
                                x
                            </button>
                        </span>
                    ))}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === ",") {
                                event.preventDefault();
                                commitDraft();
                            }
                        }}
                        onBlur={commitDraft}
                        disabled={disabled || value.length >= maxItems}
                        aria-label={ariaLabel ?? "Adicionar opção"}
                        placeholder={value.length >= maxItems ? "Limite de opções atingido" : placeholder}
                        className="h-11 flex-1 rounded-xl border border-black/10 px-3 text-sm outline-none transition focus:border-io-purple focus:ring-2 focus:ring-io-purple/10 disabled:cursor-not-allowed disabled:bg-black/5"
                    />
                    <button
                        type="button"
                        onClick={commitDraft}
                        disabled={disabled || value.length >= maxItems}
                        className="h-11 rounded-xl bg-io-purple px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Adicionar
                    </button>
                </div>
            </div>
            <p className="mt-2 text-xs text-black/50">{value.length}/{maxItems} opções</p>
            <FieldError message={error} />
        </div>
    );
}
