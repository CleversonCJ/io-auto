import { BrandMark } from "@/modules/ioauto/components/BrandMark";
import { SignupCheckoutForm } from "@/modules/ioauto/components/SignupCheckoutForm";

export default function AssinarPage() {
    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(107,0,227,0.16),transparent_28%),linear-gradient(180deg,#f6f1ff_0%,#f4f4f6_58%,#f7f3ff_100%)] px-6 py-10">
            <div className="mx-auto max-w-6xl">
                <BrandMark />
                <div className="mt-10 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
                    <section className="rounded-[40px] bg-[#180a2d] p-8 text-white shadow-[0_30px_80px_rgba(31,4,64,0.20)]">
                        <p className="text-xs uppercase tracking-[0.28em] text-white/45">Cadastro rapido + checkout</p>
                        <h1 className="mt-5 font-display text-5xl font-bold leading-[1.04]">
                            Leve o visitante do interesse ao pagamento sem alongar o formulario.
                        </h1>
                        <p className="mt-5 text-sm leading-8 text-white/72">
                            Nesta etapa o usuario informa apenas os dados essenciais da loja e segue para o checkout hospedado do Asaas para concluir a assinatura.
                        </p>

                        <div className="mt-8 grid gap-3">
                            <StepCard step="01" title="Dados basicos" body="Nome completo, nome da empresa, e-mail e telefone." />
                            <StepCard step="02" title="Checkout Asaas" body="Pagamento recorrente em ambiente externo e seguro." />
                            <StepCard step="03" title="Ativacao da conta" body="A operacao e liberada apos a confirmacao do pagamento." />
                        </div>
                    </section>

                    <div className="grid gap-6">
                        <SignupCheckoutForm compact />
                        <div className="rounded-[34px] border border-[#6b00e3]/12 bg-white p-6 shadow-[0_18px_45px_rgba(90,10,160,0.10)]">
                            <p className="text-xs uppercase tracking-[0.28em] text-[#6b00e3]/75">Importante</p>
                            <p className="mt-3 text-sm leading-7 text-black/58">
                                O fluxo depende da configuracao do checkout e do webhook no Asaas. Eu tambem vou deixar o passo a passo para voce finalizar isso em producao sem faltar nenhuma etapa.
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
