import Link from "next/link";

export default function AssinaturaSucessoPage() {
    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(107,0,227,0.12),transparent_28%),linear-gradient(180deg,#f6f1ff_0%,#f4f4f6_60%,#f7f3ff_100%)] px-6 py-10">
            <div className="mx-auto max-w-3xl rounded-[34px] border border-[#6b00e3]/12 bg-white p-8 shadow-[0_18px_45px_rgba(90,10,160,0.10)]">
                <p className="text-xs uppercase tracking-[0.28em] text-[#6b00e3]/75">Pagamento confirmado</p>
                <h1 className="mt-4 font-display text-4xl font-bold text-io-dark">Conta em processo de liberacao.</h1>
                <p className="mt-4 text-sm leading-7 text-black/55">
                    Se o onboarding foi processado corretamente, voce recebera um e-mail com o link para definir sua senha e acessar o sistema.
                </p>
                <div className="mt-6 flex gap-3">
                    <Link href="/login" className="rounded-full bg-[#6b00e3] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5800bb]">
                        Ir para login
                    </Link>
                    <Link href="/" className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-black/65 transition hover:border-[#6b00e3]/20 hover:text-[#6b00e3]">
                        Voltar para a home
                    </Link>
                </div>
            </div>
        </main>
    );
}
