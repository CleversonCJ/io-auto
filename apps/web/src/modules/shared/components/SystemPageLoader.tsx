type SystemPageLoaderProps = {
    label?: string;
    description?: string;
    compact?: boolean;
    className?: string;
};

export function SystemPageLoader({
    label = "Carregando",
    description = "Preparando seus dados...",
    compact = false,
    className = "",
}: SystemPageLoaderProps) {
    return (
        <div
            className={`io-page-loader grid place-items-center ${compact ? "min-h-52 py-8" : "min-h-[min(62vh,620px)] py-14"} ${className}`}
            role="status"
            aria-live="polite"
            aria-label={label}
        >
            <div className="flex flex-col items-center text-center">
                <div className="io-page-loader__visual" aria-hidden="true">
                    <span className="io-page-loader__halo" />
                    <span className="io-page-loader__orbit">
                        <span className="io-page-loader__dot" />
                    </span>
                    <span className="io-page-loader__mark">IO</span>
                </div>

                <p className="mt-5 text-sm font-semibold tracking-[-0.01em] text-io-dark">{label}</p>
                {description ? <p className="mt-1 text-xs text-black/45">{description}</p> : null}

                <span className="io-page-loader__track mt-4" aria-hidden="true">
                    <span />
                </span>
            </div>
            <span className="sr-only">{label}. Aguarde um momento.</span>
        </div>
    );
}
