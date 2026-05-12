"use client";

import { useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { ArrowUpRight, Banknote, BarChart3, BriefcaseBusiness, CircleAlert, CircleDollarSign, Gauge, Globe2, LayoutGrid, LineChart, MapPinned, ShieldAlert, TrendingUp, Users, Wrench } from "lucide-react";
import type { SuperAdminAlert, SuperAdminChart, SuperAdminInsight, SuperAdminMetric, SuperAdminSection } from "@/modules/superadmin/data";

type ResolvedAlert = {
    title: string;
    description: string;
    severity: SuperAdminAlert["severity"];
};

function getMetricToneClasses(tone?: SuperAdminMetric["tone"]) {
    if (tone === "emerald") return "bg-emerald-100 text-emerald-700";
    if (tone === "amber") return "bg-amber-100 text-amber-700";
    if (tone === "slate") return "bg-slate-200 text-slate-800";
    if (tone === "rose") return "bg-rose-100 text-rose-700";
    if (tone === "sky") return "bg-sky-100 text-sky-700";
    return "bg-violet-100 text-violet-700";
}

function getMetricIcon(label: string) {
    const normalized = label.trim().toLowerCase();
    if (normalized.includes("mrr") || normalized.includes("arr")) return <CircleDollarSign className="h-5 w-5" />;
    if (normalized.includes("ticket") || normalized.includes("ltv") || normalized.includes("receita")) return <Banknote className="h-5 w-5" />;
    if (normalized.includes("churn")) return <LineChart className="h-5 w-5" />;
    if (normalized.includes("cliente") || normalized.includes("conta")) return <Users className="h-5 w-5" />;
    if (normalized.includes("veículo") || normalized.includes("veiculo") || normalized.includes("estoque")) return <BriefcaseBusiness className="h-5 w-5" />;
    if (normalized.includes("anúncio") || normalized.includes("anuncio") || normalized.includes("feature")) return <LayoutGrid className="h-5 w-5" />;
    if (normalized.includes("integra")) return <Globe2 className="h-5 w-5" />;
    if (normalized.includes("lead") || normalized.includes("convers")) return <BarChart3 className="h-5 w-5" />;
    if (normalized.includes("cobran") || normalized.includes("falha") || normalized.includes("atraso")) return <CircleDollarSign className="h-5 w-5" />;
    if (normalized.includes("ticket") || normalized.includes("bug") || normalized.includes("resolução") || normalized.includes("resolucao")) return <Wrench className="h-5 w-5" />;
    if (normalized.includes("risco") || normalized.includes("saúde") || normalized.includes("saude")) return <Gauge className="h-5 w-5" />;
    if (normalized.includes("região") || normalized.includes("regiao")) return <MapPinned className="h-5 w-5" />;
    return <TrendingUp className="h-5 w-5" />;
}

function getAlertClasses(severity: SuperAdminAlert["severity"]) {
    if (severity === "critical") return "border-red-200 bg-red-50";
    if (severity === "attention") return "border-amber-200 bg-amber-50";
    return "border-emerald-200 bg-emerald-50";
}

function getAlertIcon(severity: SuperAdminAlert["severity"]) {
    if (severity === "critical") return <ShieldAlert className="h-4 w-4 text-red-600" />;
    if (severity === "attention") return <CircleAlert className="h-4 w-4 text-amber-600" />;
    return <TrendingUp className="h-4 w-4 text-emerald-600" />;
}

function getInsightClasses(tone: SuperAdminInsight["tone"]) {
    if (tone === "critical") return "border-red-200 bg-red-50 text-red-950";
    if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-950";
    return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function parseLocaleNumber(raw: string) {
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
}

function parseCurrencyValue(raw: string) {
    const match = raw.match(/R\$\s*([\d.,]+)/);
    if (!match) return null;

    const base = parseLocaleNumber(match[1]);
    if (base == null) return null;

    if (/\bmi\b/i.test(raw)) return base * 1_000_000;
    if (/\bmil\b/i.test(raw)) return base * 1_000;
    return base;
}

function parsePercentValue(raw: string) {
    const match = raw.match(/-?[\d.,]+/);
    if (!match) return null;
    return parseLocaleNumber(match[0]);
}

function parseIntegerValue(raw: string) {
    const match = raw.match(/\d+/);
    return match ? Number(match[0]) : null;
}

function parseHoursValue(raw: string) {
    const match = raw.match(/[\d.,]+/);
    if (!match) return null;
    return parseLocaleNumber(match[0]);
}

function parseMinutesValue(raw: string) {
    const match = raw.match(/[\d.,]+/);
    if (!match) return null;
    const value = parseLocaleNumber(match[0]);
    if (value == null) return null;
    return /\bh\b/i.test(raw) ? value * 60 : value;
}

function formatDecimal(value: number, digits = 1) {
    return value.toLocaleString("pt-BR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function formatSignedPercent(value: number) {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${formatDecimal(value)}%`;
}

function formatInteger(value: number) {
    return value.toLocaleString("pt-BR");
}

function getMetricByLabel(section: SuperAdminSection, label: string) {
    return section.metrics.find((metric) => metric.label === label);
}

function resolveByThreshold(
    value: number,
    criticalAt: number,
    attentionAt: number,
    invert = false,
): SuperAdminAlert["severity"] {
    if (!invert) {
        if (value >= criticalAt) return "critical";
        if (value >= attentionAt) return "attention";
        return "stable";
    }

    if (value <= criticalAt) return "critical";
    if (value <= attentionAt) return "attention";
    return "stable";
}

function resolveFinanceiroAlert(section: SuperAdminSection, index: number): ResolvedAlert | null {
    if (index === 0) {
        const mrrValue = getMetricByLabel(section, "MRR")?.value ?? "R$ 0";
        const mrrDelta = parsePercentValue(getMetricByLabel(section, "MRR")?.delta ?? "");
        if (mrrDelta == null) return null;

        const severity = mrrDelta <= 0 ? "critical" : mrrDelta < 5 ? "attention" : "stable";
        const deltaLabel = formatSignedPercent(mrrDelta);

        if (severity === "critical") {
            return {
                title: "Queda crítica de MRR",
                description: `O MRR atual está em ${mrrValue}, com variação de ${deltaLabel} vs mês anterior. O cenário pede ação imediata em retenção, pricing e expansão.`,
                severity,
            };
        }

        if (severity === "attention") {
            return {
                title: "MRR em atenção",
                description: `O MRR atual está em ${mrrValue}, com crescimento de ${deltaLabel} vs mês anterior. Há avanço, mas abaixo do ritmo esperado para a operação.`,
                severity,
            };
        }

        return {
            title: "MRR saudável",
            description: `O MRR atual está em ${mrrValue}, com crescimento de ${deltaLabel} vs mês anterior. A receita segue em uma faixa saudável no momento.`,
            severity,
        };
    }

    if (index === 1) {
        const overdueRevenueLabel = "R$ 32,6 mil";
        const overdueRevenue = parseCurrencyValue(overdueRevenueLabel);
        const currentMrr = parseCurrencyValue(getMetricByLabel(section, "MRR")?.value ?? "");
        if (overdueRevenue == null || currentMrr == null || currentMrr === 0) return null;

        const overdueRatio = (overdueRevenue / currentMrr) * 100;
        const severity = overdueRatio >= 6 ? "critical" : overdueRatio >= 3 ? "attention" : "stable";
        const ratioLabel = `${formatDecimal(overdueRatio)}%`;

        if (severity === "critical") {
            return {
                title: "Inadimplência preocupante",
                description: `A receita em atraso está em ${overdueRevenueLabel}, equivalente a ${ratioLabel} do MRR atual. O impacto já exige atuação imediata.`,
                severity,
            };
        }

        if (severity === "attention") {
            return {
                title: "Inadimplência em atenção",
                description: `A receita em atraso está em ${overdueRevenueLabel}, equivalente a ${ratioLabel} do MRR atual. O cenário merece acompanhamento próximo.`,
                severity,
            };
        }

        return {
            title: "Inadimplência sob controle",
            description: `A receita em atraso está em ${overdueRevenueLabel}, equivalente a ${ratioLabel} do MRR atual. O impacto segue administrável no momento.`,
            severity,
        };
    }

    if (index === 2) {
        const cancellations = 3;
        const churnLabel = getMetricByLabel(section, "Churn")?.value ?? "0%";
        const churn = parsePercentValue(churnLabel) ?? 0;
        const severity = cancellations > 5 || churn >= 3 ? "critical" : cancellations > 3 || churn >= 2.5 ? "attention" : "stable";

        if (severity === "critical") {
            return {
                title: "Cancelamentos preocupantes",
                description: `${cancellations} cancelamentos no mês e churn de ${churnLabel}. A perda já pressiona a base e precisa de resposta imediata.`,
                severity,
            };
        }

        if (severity === "attention") {
            return {
                title: "Cancelamentos em atenção",
                description: `${cancellations} cancelamentos no mês e churn de ${churnLabel}. O cenário ainda é controlável, mas merece reação rápida.`,
                severity,
            };
        }

        return {
            title: "Cancelamentos sob controle",
            description: `${cancellations} cancelamentos no mês e churn de ${churnLabel}. O nível atual permanece saudável para a operação.`,
            severity,
        };
    }

    return null;
}

function resolveClientesAlert(section: SuperAdminSection, index: number): ResolvedAlert | null {
    const activeClients = parseIntegerValue(getMetricByLabel(section, "Clientes ativos")?.value ?? "") ?? 0;
    const noLoginClients = parseIntegerValue(section.statCards[1]?.value ?? "") ?? 0;
    const activeIntegrations = parsePercentValue(section.statCards[2]?.value ?? "") ?? 0;
    const churnLabel = getMetricByLabel(section, "Taxa de churn")?.value ?? "0%";
    const churnRate = parsePercentValue(churnLabel) ?? 0;

    if (index === 0) {
        const severity = resolveByThreshold(noLoginClients, 18, 10);
        const ratioLabel = activeClients > 0 ? `${formatDecimal((noLoginClients / activeClients) * 100)}%` : null;

        if (severity === "critical") {
            return {
                title: "Uso da base em queda",
                description: `${formatInteger(noLoginClients)} clientes estão sem login há mais de 7 dias${ratioLabel ? `, o que representa ${ratioLabel} da base ativa` : ""}. O cenário já pressiona retenção e reativação.`,
                severity,
            };
        }

        if (severity === "attention") {
            return {
                title: "Uso da base em atenção",
                description: `${formatInteger(noLoginClients)} clientes estão sem login há mais de 7 dias${ratioLabel ? `, o que representa ${ratioLabel} da base ativa` : ""}. Vale antecipar a fila de acompanhamento.`,
                severity,
            };
        }

        return {
            title: "Uso da base saudável",
            description: `${formatInteger(noLoginClients)} clientes estão sem login há mais de 7 dias${ratioLabel ? `, o que representa ${ratioLabel} da base ativa` : ""}. O comportamento segue controlado.`,
            severity,
        };
    }

    if (index === 1) {
        const severity = resolveByThreshold(activeIntegrations, 70, 85, true);

        if (severity === "critical") {
            return {
                title: "Onboarding do Start travado",
                description: `A taxa de clientes com integração ativa está em ${formatDecimal(activeIntegrations)}%. O onboarding inicial ainda está distante do nível ideal para sustentar retenção.`,
                severity,
            };
        }

        if (severity === "attention") {
            return {
                title: "Onboarding do Start em atenção",
                description: `A taxa de clientes com integração ativa está em ${formatDecimal(activeIntegrations)}%. Há espaço claro para acelerar a conexão do segundo canal.`,
                severity,
            };
        }

        return {
            title: "Onboarding do Start saudável",
            description: `A taxa de clientes com integração ativa está em ${formatDecimal(activeIntegrations)}%. O onboarding já sustenta boa ativação da base.`,
            severity,
        };
    }

    if (index === 2) {
        const severity = churnRate >= 3 ? "critical" : churnRate >= 2.5 ? "attention" : "stable";

        if (severity === "critical") {
            return {
                title: "Retenção regional pressionada",
                description: `A taxa de churn atual está em ${churnLabel}. Mesmo com bolsões mais saudáveis, a retenção regional exige ação imediata.`,
                severity,
            };
        }

        if (severity === "attention") {
            return {
                title: "Retenção regional em atenção",
                description: `A taxa de churn atual está em ${churnLabel}. O Sul segue forte, mas a média da base ainda pede acompanhamento.`,
                severity,
            };
        }

        return {
            title: "Retenção regional saudável",
            description: `A taxa de churn atual está em ${churnLabel}. O comportamento geral da base segue estável, com destaque positivo para as regiões mais maduras.`,
            severity,
        };
    }

    return null;
}

function resolveProdutoAlert(section: SuperAdminSection, index: number): ResolvedAlert | null {
    const reportsAdoptionLabel = getMetricByLabel(section, "Adoção de relatórios")?.value ?? "0%";
    const reportsAdoption = parsePercentValue(reportsAdoptionLabel) ?? 0;
    const websiteActiveCount = parseIntegerValue(section.statCards[2]?.value ?? "") ?? 0;
    const stockUpdatedLabel = section.statCards[1]?.value ?? "0%";
    const stockUpdated = parsePercentValue(stockUpdatedLabel) ?? 0;

    if (index === 0) {
        const severity = resolveByThreshold(reportsAdoption, 30, 50, true);
        if (severity === "critical") return { title: "Relatórios com adoção crítica", description: `A adoção do módulo de relatórios está em ${reportsAdoptionLabel}. O uso ainda está muito abaixo do esperado para uma feature estratégica.`, severity };
        if (severity === "attention") return { title: "Relatórios em atenção", description: `A adoção do módulo de relatórios está em ${reportsAdoptionLabel}. O recurso já mostra valor, mas ainda não virou rotina da base.`, severity };
        return { title: "Relatórios saudáveis", description: `A adoção do módulo de relatórios está em ${reportsAdoptionLabel}. O uso já sustenta uma boa presença operacional.`, severity };
    }

    if (index === 1) {
        const severity = websiteActiveCount >= 55 ? "stable" : websiteActiveCount >= 40 ? "attention" : "critical";
        if (severity === "critical") return { title: "Site próprio subutilizado", description: `${formatInteger(websiteActiveCount)} revendas estão com site próprio ativo. O impacto positivo em permanência ainda está abaixo do potencial.`, severity };
        if (severity === "attention") return { title: "Site próprio ganhando espaço", description: `${formatInteger(websiteActiveCount)} revendas estão com site próprio ativo. A feature avança, mas ainda pode crescer na base.`, severity };
        return { title: "Site próprio fortalece retenção", description: `${formatInteger(websiteActiveCount)} revendas estão com site próprio ativo. A adoção já reforça bem a permanência do produto.`, severity };
    }

    if (index === 2) {
        const severity = resolveByThreshold(stockUpdated, 65, 80, true);
        if (severity === "critical") return { title: "Cadastro manual derruba engajamento", description: `Só ${stockUpdatedLabel} da base manteve o estoque atualizado em 7 dias. O onboarding ainda depende demais de esforço manual.`, severity };
        if (severity === "attention") return { title: "Atualização de estoque em atenção", description: `${stockUpdatedLabel} da base manteve o estoque atualizado em 7 dias. A tração existe, mas ainda há fricção operacional.`, severity };
        return { title: "Atualização de estoque saudável", description: `${stockUpdatedLabel} da base manteve o estoque atualizado em 7 dias. O uso operacional já sustenta bom engajamento.`, severity };
    }

    return null;
}

function resolveMarketplacesAlert(section: SuperAdminSection, index: number): ResolvedAlert | null {
    const webmotorsCloseRate = parsePercentValue(section.leaderboard[0]?.value ?? "") ?? 0;
    const iCarrosRoi = parsePercentValue(section.leaderboard[2]?.value ?? "") ?? 0;
    const responseLabel = section.statCards[1]?.value ?? "0 min";
    const responseMinutes = parseMinutesValue(responseLabel) ?? 0;

    if (index === 0) {
        const severity = webmotorsCloseRate >= 17 ? "stable" : webmotorsCloseRate >= 13 ? "attention" : "critical";
        if (severity === "critical") return { title: "Webmotors perdeu eficiência", description: `A taxa de fechamento do canal está em ${section.leaderboard[0]?.value ?? "0%"}. O desempenho já está abaixo do padrão esperado.`, severity };
        if (severity === "attention") return { title: "Webmotors em atenção", description: `A taxa de fechamento do canal está em ${section.leaderboard[0]?.value ?? "0%"}. O canal segue relevante, mas sem a mesma folga de performance.`, severity };
        return { title: "Webmotors lidera conversão", description: `A taxa de fechamento do canal está em ${section.leaderboard[0]?.value ?? "0%"}. O desempenho segue como referência entre os canais premium.`, severity };
    }

    if (index === 1) {
        const severity = iCarrosRoi < 10 ? "critical" : iCarrosRoi < 18 ? "attention" : "stable";
        if (severity === "critical") return { title: "iCarros com tração crítica", description: `O ROI atual do canal está em ${section.leaderboard[2]?.value ?? "0%"}. O retorno já compromete a alocação desse marketplace.`, severity };
        if (severity === "attention") return { title: "iCarros em atenção", description: `O ROI atual do canal está em ${section.leaderboard[2]?.value ?? "0%"}. O canal ainda entrega pouco frente aos demais.`, severity };
        return { title: "iCarros com retorno saudável", description: `O ROI atual do canal está em ${section.leaderboard[2]?.value ?? "0%"}. O desempenho já é mais equilibrado na carteira.`, severity };
    }

    if (index === 2) {
        const severity = responseMinutes > 20 ? "critical" : responseMinutes > 12 ? "attention" : "stable";
        if (severity === "critical") return { title: "OLX perde lead por demora", description: `O tempo médio de resposta está em ${responseLabel}. O SLA já está acima do ponto em que a conversão começa a cair forte.`, severity };
        if (severity === "attention") return { title: "OLX com SLA em atenção", description: `O tempo médio de resposta está em ${responseLabel}. O canal ainda converte, mas a velocidade pode melhorar.`, severity };
        return { title: "OLX com resposta saudável", description: `O tempo médio de resposta está em ${responseLabel}. O SLA atual sustenta bem a captura de leads.`, severity };
    }

    return null;
}

function resolveCrescimentoAlert(section: SuperAdminSection, index: number): ResolvedAlert | null {
    const referralsLabel = getMetricByLabel(section, "Indicações")?.value ?? "0%";
    const referrals = parsePercentValue(referralsLabel) ?? 0;
    const overallCacLabel = getMetricByLabel(section, "CAC")?.value ?? "R$ 0";
    const overallCac = parseCurrencyValue(overallCacLabel) ?? 0;
    const partnerShare = section.charts[0]?.series[0]?.data?.[3] ?? 0;
    const paidCac = section.charts[2]?.series[0]?.data?.[3] ?? 0;

    if (index === 0) {
        const severity = referrals >= 35 && overallCac <= 800 ? "stable" : referrals >= 25 && overallCac <= 900 ? "attention" : "critical";
        if (severity === "critical") return { title: "Indicação ainda não domina a aquisição", description: `Indicações representam ${referralsLabel} da origem dos clientes e o CAC médio está em ${overallCacLabel}. O canal ainda não sustenta a eficiência ideal.`, severity };
        if (severity === "attention") return { title: "Indicação em evolução", description: `Indicações representam ${referralsLabel} da origem dos clientes e o CAC médio está em ${overallCacLabel}. A tendência é boa, mas ainda não é dominante.`, severity };
        return { title: "Indicação virou o motor mais eficiente", description: `Indicações representam ${referralsLabel} da origem dos clientes e o CAC médio está em ${overallCacLabel}. O canal já sustenta o melhor custo de aquisição.`, severity };
    }

    if (index === 1) {
        const severity = partnerShare < 12 ? "critical" : partnerShare < 18 ? "attention" : "stable";
        if (severity === "critical") return { title: "Parceiros perderam tração", description: `Parceiros respondem por ${formatInteger(partnerShare)}% da aquisição do mês. O canal já ficou abaixo da faixa saudável e pede revisão.`, severity };
        if (severity === "attention") return { title: "Parceiros em atenção", description: `Parceiros respondem por ${formatInteger(partnerShare)}% da aquisição do mês. O canal segue vivo, mas distante do potencial.`, severity };
        return { title: "Parceiros com participação saudável", description: `Parceiros respondem por ${formatInteger(partnerShare)}% da aquisição do mês. A origem segue contribuindo de forma consistente.`, severity };
    }

    if (index === 2) {
        const severity = paidCac > 1000 ? "critical" : paidCac > 800 ? "attention" : "stable";
        const paidCacLabel = `R$ ${formatInteger(paidCac)}`;
        if (severity === "critical") return { title: "Tráfego pago ainda caro", description: `O CAC de tráfego pago está em ${paidCacLabel}. O canal já opera acima do patamar aceitável para a margem atual.`, severity };
        if (severity === "attention") return { title: "Tráfego pago em atenção", description: `O CAC de tráfego pago está em ${paidCacLabel}. O canal ainda funciona, mas precisa de otimização para ganhar eficiência.`, severity };
        return { title: "Tráfego pago saudável", description: `O CAC de tráfego pago está em ${paidCacLabel}. O canal segue em uma faixa compatível com o plano de crescimento.`, severity };
    }

    return null;
}

function resolveCobrancaAlert(section: SuperAdminSection, index: number): ResolvedAlert | null {
    const paymentFailureLabel = getMetricByLabel(section, "Falha de pagamento")?.value ?? "0%";
    const paymentFailure = parsePercentValue(paymentFailureLabel) ?? 0;
    const averageDelayLabel = getMetricByLabel(section, "Atraso médio")?.value ?? "0 dias";
    const averageDelay = parsePercentValue(averageDelayLabel) ?? 0;
    const recoveryLabel = getMetricByLabel(section, "Recuperação 7 dias")?.value ?? "0%";
    const recoveryRate = parsePercentValue(recoveryLabel) ?? 0;

    if (index === 0) {
        const severity = paymentFailure >= 4 ? "critical" : paymentFailure >= 2.5 ? "attention" : "stable";
        if (severity === "critical") return { title: "Falha de pagamento preocupante", description: `A taxa de falha de pagamento está em ${paymentFailureLabel}. O volume já pressiona receita e exige ação manual imediata.`, severity };
        if (severity === "attention") return { title: "Falha de pagamento em atenção", description: `A taxa de falha de pagamento está em ${paymentFailureLabel}. O comportamento ainda é recuperável, mas pede reforço na cobrança.`, severity };
        return { title: "Falha de pagamento sob controle", description: `A taxa de falha de pagamento está em ${paymentFailureLabel}. O nível atual segue administrável para a operação.`, severity };
    }

    if (index === 1) {
        const severity = averageDelay >= 10 ? "critical" : averageDelay >= 6 ? "attention" : "stable";
        if (severity === "critical") return { title: "Boletos vencidos pressionam a carteira", description: `O atraso médio está em ${averageDelayLabel}. A recorrência já sinaliza risco mais alto de churn por inadimplência.`, severity };
        if (severity === "attention") return { title: "Boletos vencidos em atenção", description: `O atraso médio está em ${averageDelayLabel}. O cenário ainda é recuperável, mas exige disciplina de acompanhamento.`, severity };
        return { title: "Boletos vencidos sob controle", description: `O atraso médio está em ${averageDelayLabel}. A carteira segue dentro de uma faixa saudável de regularização.`, severity };
    }

    if (index === 2) {
        const severity = resolveByThreshold(recoveryRate, 55, 65, true);
        if (severity === "critical") return { title: "Recuperação em 7 dias abaixo do ideal", description: `A taxa de recuperação em 7 dias está em ${recoveryLabel}. O playbook atual ainda não está absorvendo bem a carteira vencida.`, severity };
        if (severity === "attention") return { title: "Recuperação em 7 dias em atenção", description: `A taxa de recuperação em 7 dias está em ${recoveryLabel}. A evolução é positiva, mas ainda pede refinamento.`, severity };
        return { title: "Recuperação em 7 dias saudável", description: `A taxa de recuperação em 7 dias está em ${recoveryLabel}. O playbook atual já sustenta boa recuperação da receita.`, severity };
    }

    return null;
}

function resolveOperacionalAlert(section: SuperAdminSection, index: number): ResolvedAlert | null {
    const bugsCount = parseIntegerValue(getMetricByLabel(section, "Bugs reportados")?.value ?? "") ?? 0;
    const responseLabel = getMetricByLabel(section, "Resposta média")?.value ?? "0 min";
    const responseMinutes = parseMinutesValue(responseLabel) ?? 0;
    const resolutionLabel = getMetricByLabel(section, "Resolução média")?.value ?? "0 h";
    const resolutionHours = parseHoursValue(resolutionLabel) ?? 0;

    if (index === 0) {
        const severity = resolveByThreshold(bugsCount, 8, 5);
        if (severity === "critical") return { title: "Fila de bugs nas integrações crítica", description: `${formatInteger(bugsCount)} bugs estão reportados no momento. A concentração em integrações já afeta a estabilidade operacional.`, severity };
        if (severity === "attention") return { title: "Fila de bugs nas integrações em atenção", description: `${formatInteger(bugsCount)} bugs estão reportados no momento. O volume ainda é gerenciável, mas já exige priorização.`, severity };
        return { title: "Fila de bugs nas integrações sob controle", description: `${formatInteger(bugsCount)} bugs estão reportados no momento. O volume atual ainda não pressiona o fluxo do time.`, severity };
    }

    if (index === 1) {
        const severity = responseMinutes > 30 ? "critical" : responseMinutes > 20 ? "attention" : "stable";
        if (severity === "critical") return { title: "Primeira resposta lenta", description: `O tempo médio de primeira resposta está em ${responseLabel}. O SLA já está acima do ideal para a experiência de suporte.`, severity };
        if (severity === "attention") return { title: "Primeira resposta em atenção", description: `O tempo médio de primeira resposta está em ${responseLabel}. O time ainda responde bem, mas sem a folga desejada.`, severity };
        return { title: "Primeira resposta saudável", description: `O tempo médio de primeira resposta está em ${responseLabel}. O suporte segue com velocidade adequada para a fila atual.`, severity };
    }

    if (index === 2) {
        const severity = resolutionHours > 8 ? "critical" : resolutionHours > 6 ? "attention" : "stable";
        if (severity === "critical") return { title: "Resolução média alta", description: `O tempo médio de resolução está em ${resolutionLabel}. A complexidade dos tickets já compromete o ritmo ideal da operação.`, severity };
        if (severity === "attention") return { title: "Resolução média em atenção", description: `O tempo médio de resolução está em ${resolutionLabel}. O time mantém o fluxo, mas ainda sente o peso dos casos complexos.`, severity };
        return { title: "Resolução média saudável", description: `O tempo médio de resolução está em ${resolutionLabel}. A operação já trabalha dentro de uma faixa confortável.`, severity };
    }

    return null;
}

function resolveInsightsAlert(section: SuperAdminSection, index: number): ResolvedAlert | null {
    const upgradeReady = parseIntegerValue(getMetricByLabel(section, "Prontas para upgrade")?.value ?? "") ?? 0;
    const highChurnRisk = parseIntegerValue(getMetricByLabel(section, "Risco alto de churn")?.value ?? "") ?? 0;
    const subutilizedFeatures = parseIntegerValue(getMetricByLabel(section, "Features subutilizadas")?.value ?? "") ?? 0;

    if (index === 0) {
        const severity = upgradeReady >= 15 ? "stable" : upgradeReady >= 8 ? "attention" : "critical";
        if (severity === "critical") return { title: "Poucas contas prontas para upgrade", description: `${formatInteger(upgradeReady)} contas estão prontas para upgrade. O potencial de expansão ainda está abaixo do esperado.`, severity };
        if (severity === "attention") return { title: "Upsell em formação", description: `${formatInteger(upgradeReady)} contas estão prontas para upgrade. Há boa oportunidade, mas ainda sem massa ideal.`, severity };
        return { title: "Upsell em evidência", description: `${formatInteger(upgradeReady)} contas estão prontas para upgrade. O cenário já mostra fila relevante de expansão.`, severity };
    }

    if (index === 1) {
        const severity = highChurnRisk > 10 ? "critical" : highChurnRisk > 5 ? "attention" : "stable";
        if (severity === "critical") return { title: "Churn previsível em alta", description: `${formatInteger(highChurnRisk)} contas estão com risco alto de churn. O volume já pede atuação preventiva imediata.`, severity };
        if (severity === "attention") return { title: "Churn previsível em atenção", description: `${formatInteger(highChurnRisk)} contas estão com risco alto de churn. O cenário é tratável, mas já merece priorização.`, severity };
        return { title: "Churn previsível sob controle", description: `${formatInteger(highChurnRisk)} contas estão com risco alto de churn. A fila atual ainda permanece administrável.`, severity };
    }

    if (index === 2) {
        const severity = resolveByThreshold(subutilizedFeatures, 5, 3);
        if (severity === "critical") return { title: "Subutilização de features crítica", description: `${formatInteger(subutilizedFeatures)} módulos seguem abaixo do alvo de adoção. O produto ainda carrega receita escondida sem ativação suficiente.`, severity };
        if (severity === "attention") return { title: "Subutilização de features em atenção", description: `${formatInteger(subutilizedFeatures)} módulos seguem abaixo do alvo de adoção. Há oportunidade clara de gerar mais valor na base.`, severity };
        return { title: "Subutilização de features sob controle", description: `${formatInteger(subutilizedFeatures)} módulos seguem abaixo do alvo de adoção. O gap atual já está em faixa aceitável.`, severity };
    }

    return null;
}

function resolveTenantsAlert(section: SuperAdminSection, index: number): ResolvedAlert | null {
    const mrrCoverage = parsePercentValue(getMetricByLabel(section, "MRR mapeado")?.delta ?? "") ?? 0;
    const recentAccess = parsePercentValue(getMetricByLabel(section, "Acesso recente")?.value ?? "") ?? 0;
    const recentAccounts = parseIntegerValue(getMetricByLabel(section, "Contas recentes")?.value ?? "") ?? 0;
    const activationRate = section.charts[3]?.series[0]?.data?.slice(-1)[0] ?? 0;

    if (index === 0) {
        const severity = mrrCoverage >= 100 ? "stable" : mrrCoverage >= 90 ? "attention" : "critical";
        if (severity === "critical") return { title: "Cobertura da carteira incompleta", description: `${formatDecimal(mrrCoverage, 0)}% do MRR está mapeado entre os tenants. A visão operacional ainda não cobre toda a carteira.`, severity };
        if (severity === "attention") return { title: "Cobertura da carteira em atenção", description: `${formatDecimal(mrrCoverage, 0)}% do MRR está mapeado entre os tenants. A visibilidade já é boa, mas ainda não está completa.`, severity };
        return { title: "Cobertura da carteira saudável", description: `${formatDecimal(mrrCoverage, 0)}% do MRR está mapeado entre os tenants. A visão operacional já cobre a carteira com segurança.`, severity };
    }

    if (index === 1) {
        const severity = resolveByThreshold(recentAccess, 70, 85, true);
        if (severity === "critical") return { title: "Último acesso preocupa", description: `${formatDecimal(recentAccess)}% das empresas tiveram login recente. O comportamento já sinaliza necessidade forte de reativação.`, severity };
        if (severity === "attention") return { title: "Último acesso em atenção", description: `${formatDecimal(recentAccess)}% das empresas tiveram login recente. A base ainda pede vigilância no engajamento.`, severity };
        return { title: "Último acesso saudável", description: `${formatDecimal(recentAccess)}% das empresas tiveram login recente. A frequência da base segue em boa faixa operacional.`, severity };
    }

    if (index === 2) {
        const severity = resolveByThreshold(activationRate, 45, 55, true);
        if (severity === "critical") return { title: "Contas recentes pedem ação imediata", description: `${formatInteger(recentAccounts)} contas entraram recentemente e a ativação atual está em ${formatDecimal(activationRate, 0)}%. O onboarding ainda exige intervenção rápida.`, severity };
        if (severity === "attention") return { title: "Contas recentes em atenção", description: `${formatInteger(recentAccounts)} contas entraram recentemente e a ativação atual está em ${formatDecimal(activationRate, 0)}%. Há tração, mas ainda sem folga operacional.`, severity };
        return { title: "Contas recentes com ativação saudável", description: `${formatInteger(recentAccounts)} contas entraram recentemente e a ativação atual está em ${formatDecimal(activationRate, 0)}%. A entrada mais nova segue em boa faixa de adoção.`, severity };
    }

    return null;
}

function getResolvedAlert(section: SuperAdminSection, alert: SuperAdminAlert, index: number): ResolvedAlert {
    return (
        resolveFinanceiroAlert(section, index) ??
        resolveClientesAlert(section, index) ??
        resolveProdutoAlert(section, index) ??
        resolveMarketplacesAlert(section, index) ??
        resolveCrescimentoAlert(section, index) ??
        resolveCobrancaAlert(section, index) ??
        resolveOperacionalAlert(section, index) ??
        resolveInsightsAlert(section, index) ??
        resolveTenantsAlert(section, index) ?? {
            title: alert.title,
            description: alert.description,
            severity: alert.severity,
        }
    );
}

function buildChartOptions(chart: SuperAdminChart): Highcharts.Options {
    return {
        chart: {
            backgroundColor: "transparent",
            spacing: [20, 12, 12, 12],
            height: chart.type === "bar" ? Math.max(320, (chart.categories?.length ?? 0) * 56 + 100) : 320,
            type: chart.type === "area" ? "areaspline" : chart.type,
        },
        title: { text: undefined },
        credits: { enabled: false },
        legend: {
            enabled: chart.type !== "pie",
            itemStyle: {
                color: "#212121",
                fontWeight: "600",
            },
            symbolRadius: 999,
        },
        tooltip: {
            backgroundColor: "#111827",
            borderWidth: 0,
            borderRadius: 16,
            style: { color: "#ffffff" },
            shared: chart.type !== "pie",
            pointFormatter: function pointFormatter() {
                const prefix = chart.valuePrefix ?? "";
                const suffix = chart.valueSuffix ?? "";
                return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <b>${prefix}${this.y}${suffix}</b><br/>`;
            },
        },
        xAxis: chart.type === "pie"
            ? undefined
            : {
                categories: chart.categories,
                lineColor: "#d9d9d9",
                tickColor: "#d9d9d9",
                labels: {
                    style: {
                        color: "#5b6170",
                        fontSize: "11px",
                    },
                },
            },
        yAxis: chart.type === "pie"
            ? undefined
            : {
                title: { text: undefined },
                gridLineColor: "rgba(20,33,61,0.08)",
                labels: {
                    style: {
                        color: "#5b6170",
                        fontSize: "11px",
                    },
                    formatter: function formatter() {
                        const prefix = chart.valuePrefix ?? "";
                        const suffix = chart.valueSuffix ?? "";
                        return `${prefix}${this.value}${suffix}`;
                    },
                },
            },
        plotOptions: {
            series: {
                animation: false,
                marker: {
                    enabled: chart.type === "line" || chart.type === "area",
                    radius: 3,
                },
                lineWidth: chart.type === "line" || chart.type === "area" ? 3 : undefined,
            },
            column: chart.type === "column" ? { borderRadius: 10 } : undefined,
            bar: chart.type === "bar" ? { borderRadius: 10 } : undefined,
            pie: {
                innerSize: "58%",
                borderWidth: 0,
                colors: chart.pieColors,
                dataLabels: {
                    enabled: true,
                    format: "{point.percentage:.0f}%",
                    style: { textOutline: "none" },
                },
            },
            areaspline: {
                fillOpacity: 0.18,
            },
        },
        series: chart.type === "pie"
            ? [
                {
                    type: "pie",
                    name: chart.series[0]?.name ?? chart.title,
                    data: (chart.series[0]?.data ?? []).map((value, index) => ({
                        name: chart.categories?.[index] ?? `Item ${index + 1}`,
                        y: value,
                    })),
                },
            ]
            : chart.series.map((serie) => ({
                type: chart.type === "area" ? "areaspline" : chart.type,
                name: serie.name,
                data: serie.data,
                color: serie.color,
            })),
    };
}

function ChartCard({ chart }: { chart: SuperAdminChart }) {
    const options = useMemo(() => buildChartOptions(chart), [chart]);

    return (
        <article className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
            <div>
                <h3 className="font-display text-2xl font-bold text-io-dark">{chart.title}</h3>
                <p className="mt-2 text-sm text-black/55">{chart.subtitle}</p>
            </div>
            <div className="mt-5 rounded-[28px] bg-io-light p-4">
                <HighchartsReact highcharts={Highcharts} options={options} />
            </div>
        </article>
    );
}

export function SuperAdminDashboardSection({
    section,
    resolveAlerts = true,
}: {
    section: SuperAdminSection;
    resolveAlerts?: boolean;
}) {
    return (
        <div className="grid gap-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {section.metrics.map((metric) => (
                    <article key={metric.label} className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-between gap-3">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getMetricToneClasses(metric.tone)}`}>{metric.label}</span>
                            <span className={`grid h-10 w-10 place-items-center rounded-2xl ${getMetricToneClasses(metric.tone)}`}>
                                {getMetricIcon(metric.label)}
                            </span>
                        </div>
                        <p className="mt-5 text-3xl font-bold text-io-dark">{metric.value}</p>
                        <p className="mt-2 text-sm text-black/52">{metric.hint}</p>
                        {metric.delta ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-black/45">{metric.delta}</p> : null}
                    </article>
                ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
                {section.alerts.map((alert, index) => {
                    const resolvedAlert = resolveAlerts ? getResolvedAlert(section, alert, index) : alert;

                    return (
                        <article key={alert.title} className={`rounded-[28px] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.04)] ${getAlertClasses(resolvedAlert.severity)}`}>
                            <div className="flex items-center gap-2">
                                {getAlertIcon(resolvedAlert.severity)}
                                <p className="text-sm font-semibold text-io-dark">{resolvedAlert.title}</p>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-black/70">{resolvedAlert.description}</p>
                        </article>
                    );
                })}
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
                {section.charts.map((chart) => (
                    <ChartCard key={chart.title} chart={chart} />
                ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
                <article className="flex h-full flex-col rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Recortes rápidos</p>
                            <h2 className="mt-2 font-display text-3xl font-bold text-io-dark">Blocos executivos</h2>
                        </div>
                        <ArrowUpRight className="h-5 w-5 text-black/35" />
                    </div>
                    <div className="mt-5 grid flex-1 gap-3">
                        {section.statCards.map((card) => (
                            <div key={card.label} className="rounded-[24px] bg-black/[0.03] px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-io-dark">{card.label}</p>
                                    <span className="text-lg font-bold text-io-dark">{card.value}</span>
                                </div>
                                <p className="mt-2 text-sm text-black/54">{card.detail}</p>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="flex h-full flex-col rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">{section.label}</p>
                    <h2 className="mt-2 font-display text-3xl font-bold text-io-dark">{section.leaderboardTitle}</h2>
                    <div className="mt-5 grid flex-1 gap-3">
                        {section.leaderboard.map((row) => (
                            <div key={row.name} className="rounded-[24px] border border-black/10 bg-white px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-io-dark">{row.name}</p>
                                        <p className="mt-1 text-sm text-black/54">{row.detail}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-io-dark">{row.value}</p>
                                        {row.badge ? (
                                            <span className="mt-2 inline-flex rounded-full bg-io-dark px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                                                {row.badge}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </article>
            </section>

            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Leitura acionável</p>
                <h2 className="mt-2 font-display text-3xl font-bold text-io-dark">Insights para decisão</h2>
                <div className="mt-5 grid gap-3 xl:grid-cols-3">
                    {section.insights.map((insight) => (
                        <article key={insight.title} className={`rounded-[24px] border px-4 py-4 ${getInsightClasses(insight.tone)}`}>
                            <p className="text-sm font-semibold">{insight.title}</p>
                            <p className="mt-3 text-sm leading-6 opacity-82">{insight.description}</p>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}
