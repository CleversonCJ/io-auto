import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LoginForm } from "@/modules/auth/components/LoginForm";
import { ACCESS_COOKIE } from "@/core/auth/cookies";
import { BrandMark } from "@/modules/ioauto/components/BrandMark";

export default async function LoginPage() {
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (token) redirect("/protected/dashboard");

    return (
        <main className="min-h-screen bg-io-light">

            <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-6 py-10">
                <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-[1.15fr_0.85fr]">
                    <section className="hidden rounded-[40px] border border-black/10 bg-white p-10 shadow-[0_30px_80px_rgba(0,0,0,0.08)] lg:flex lg:flex-col lg:justify-between">
                        <div>
                            <BrandMark />
                            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.04] text-io-dark">
                                Entre no painel operacional do seu ecossistema automotivo.
                            </h1>
                            <p className="mt-5 max-w-xl text-base leading-8 text-black/60">
                                Estoque, leads, publicacoes e assinatura em uma experiencia mais limpa, moderna e pronta para crescer em multi-tenant.
                            </p>
                        </div>

                        <div className="grid gap-3">
                            <div className="rounded-[28px] bg-io-purple p-5 text-white">
                                <p className="text-xs uppercase tracking-[0.28em] text-white/45">Operacao</p>
                                <p className="mt-3 text-lg font-semibold">Atendimento 100% humano com origem do lead visivel</p>
                            </div>
                            <div className="rounded-[28px] border border-black/10 bg-[#f6f6f6] p-5">
                                <p className="text-sm text-black/55">Use o mesmo e-mail e senha configurados na ativacao da assinatura para entrar.</p>
                            </div>
                        </div>
                    </section>

                    <section className="flex items-center justify-center">
                        <div className="w-full max-w-lg rounded-[36px] border border-black/10 bg-white p-8 shadow-[0_30px_80px_rgba(0,0,0,0.08)]">
                            <div className="mb-8 lg:hidden">
                                <BrandMark />
                            </div>
                            <LoginForm embedded />
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
