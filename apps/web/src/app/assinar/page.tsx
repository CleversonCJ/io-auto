import { BrandMark } from "@/modules/ioauto/components/BrandMark";

export default function AssinarPage() {
    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(107,0,227,0.16),transparent_28%),linear-gradient(180deg,#f6f1ff_0%,#f4f4f6_58%,#f7f3ff_100%)] px-6 py-10">
            <div className="mx-auto max-w-6xl">
                <BrandMark />
                <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
                    <section className="rounded-[40px] bg-[#180a2d] p-8 text-white shadow-[0_30px_80px_rgba(31,4,64,0.20)]">
                        <p className="text-xs uppercase tracking-[0.28em] text-white/45">Onboarding via LP</p>
                        <h1 className="mt-5 font-display text-5xl font-bold leading-[1.04]">
                            O cadastro inicial e ativacao agora acontecem via LP + webhook de pagamento.
                        </h1>
                        <p className="mt-5 text-sm leading-8 text-white/72">
                            Este ambiente nao cria mais checkout publico. A LP externa envia o pre-cadastro para o backend (INACTIVE) e, apos pagamento confirmado, ativa a conta e dispara o e-mail para definir senha.
                        </p>

                        <div className="mt-8 grid gap-3">
                            <StepCard step="01" title="Register" body="A LP envia dados do cliente para /v1/onboarding/first-user/register e cria usuario/empresa INACTIVE." />
                            <StepCard step="02" title="Activate" body="Ao confirmar pagamento, a LP chama /v1/onboarding/first-user/activate." />
                            <StepCard step="03" title="Send Access Email" body="Com a conta ativa, o backend gera token e envia e-mail de definicao de senha." />
                        </div>
                    </section>

                    <div className="grid gap-6">
                        <div className="rounded-[34px] border border-[#6b00e3]/12 bg-white p-6 shadow-[0_18px_45px_rgba(90,10,160,0.10)]">
                            <p className="text-xs uppercase tracking-[0.28em] text-[#6b00e3]/75">Endpoints oficiais</p>
                            <p className="mt-3 text-sm leading-7 text-black/58">
                                Use somente: /v1/onboarding/first-user/register, /v1/onboarding/first-user/activate e /v1/onboarding/first-user/send-access-email.
                            </p>
                        </div>
                        <div className="rounded-[34px] border border-[#6b00e3]/12 bg-white p-6 shadow-[0_18px_45px_rgba(90,10,160,0.10)]">
                            <p className="text-xs uppercase tracking-[0.28em] text-[#6b00e3]/75">Seguranca</p>
                            <p className="mt-3 text-sm leading-7 text-black/58">
                                As chamadas de onboarding devem usar Authorization Bearer com token interno e idempotencyKey unica por evento.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

function StepCard({
    step,
    title,
    body,
}: {
    step: string;
    title: string;
    body: string;
}) {
    return (
        <div className="grid grid-cols-[auto_1fr] gap-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#6b00e3] text-sm font-bold text-white">{step}</div>
            <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm leading-6 text-white/68">{body}</p>
            </div>
        </div>
    );
}
