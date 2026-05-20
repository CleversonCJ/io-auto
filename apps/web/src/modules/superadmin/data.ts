export type SuperAdminMetric = {
    label: string;
    value: string;
    hint: string;
    delta?: string;
    tone?: "violet" | "emerald" | "amber" | "slate" | "rose" | "sky";
};

export type SuperAdminAlert = {
    title: string;
    description: string;
    severity: "critical" | "attention" | "stable";
};

export type SuperAdminChart = {
    title: string;
    subtitle: string;
    type: "line" | "area" | "column" | "bar" | "pie";
    valueFormat?: "currency" | "number" | "percent";
    valueDecimals?: number;
    categories?: string[];
    series: Array<{
        name: string;
        data: number[];
        color?: string;
    }>;
    pieColors?: string[];
    valuePrefix?: string;
    valueSuffix?: string;
};

export type SuperAdminStatCard = {
    label: string;
    value: string;
    detail: string;
};

export type SuperAdminLeaderboardRow = {
    name: string;
    detail: string;
    value: string;
    badge?: string;
};

export type SuperAdminInsight = {
    title: string;
    description: string;
    tone: "positive" | "warning" | "critical";
};

export type SuperAdminSectionKey =
    | "financeiro"
    | "clientes"
    | "produto"
    | "marketplaces"
    | "crescimento"
    | "cobranca"
    | "operacional"
    | "insights"
    | "planos"
    | "tenants"
    | "configuracoes";

export type SuperAdminSection = {
    key: SuperAdminSectionKey;
    label: string;
    eyebrow: string;
    title: string;
    description: string;
    spotlight: string;
    metrics: SuperAdminMetric[];
    alerts: SuperAdminAlert[];
    charts: SuperAdminChart[];
    statCards: SuperAdminStatCard[];
    leaderboardTitle: string;
    leaderboard: SuperAdminLeaderboardRow[];
    insights: SuperAdminInsight[];
};

export type SuperAdminNavItem = {
    href: string;
    label: string;
    summary: string;
};

export type SuperAdminPillar = {
    label: string;
    score: number;
    change: string;
    summary: string;
};

export const superAdminNavItems: SuperAdminNavItem[] = [
    { href: "/protected/superadmin/financeiro", label: "Financeiro", summary: "MRR, ARR e churn" },
    { href: "/protected/superadmin/clientes", label: "Clientes", summary: "Saúde da base e risco" },
    { href: "/protected/superadmin/produto", label: "Produto", summary: "Uso real da plataforma" },
    { href: "/protected/superadmin/marketplaces", label: "Marketplaces", summary: "Canais e performance" },
    { href: "/protected/superadmin/crescimento", label: "Crescimento", summary: "Aquisição e payback" },
    { href: "/protected/superadmin/parceiros", label: "Parceiros", summary: "Leads, comissões e ranking" },
    { href: "/protected/superadmin/cobranca", label: "Cobrança", summary: "Atrasos e falhas" },
    { href: "/protected/superadmin/operacional", label: "Operacional", summary: "Suporte e bugs" },
    { href: "/protected/superadmin/insights", label: "Insights", summary: "Risco, upgrade e upsell" },
    { href: "/protected/superadmin/tenants", label: "Tenants", summary: "Gestão operacional das contas" },
    { href: "/protected/superadmin/planos", label: "Planos", summary: "Catalogo, limites e recursos" },
    { href: "/protected/superadmin/configuracoes", label: "Configurações", summary: "Suporte e ajustes globais" },
];

export const superAdminPillars: SuperAdminPillar[] = [
    {
        label: "Financeiro",
        score: 84,
        change: "+8 pts no trimestre",
        summary: "MRR em alta, mas cobrança pede atenção em 11 contas com atraso recorrente.",
    },
    {
        label: "Clientes",
        score: 79,
        change: "-3 pts na semana",
        summary: "A base segue saudável, mas 14 revendas perderam frequência de login.",
    },
    {
        label: "Produto",
        score: 88,
        change: "+11 pts no mês",
        summary: "Integrações com marketplaces sustentam o uso, enquanto relatórios seguem subutilizados.",
    },
    {
        label: "Crescimento",
        score: 73,
        change: "+5 pts no mês",
        summary: "Indicações aceleram, porém o CAC de tráfego pago ainda pressiona o payback.",
    },
];

export const superAdminExecutiveAlerts: SuperAdminAlert[] = [
    {
        title: "Queda de MRR em revendas pequenas",
        description: "O cluster de até 20 carros recuou 4,2% nos últimos 30 dias e merece revisão de pricing e onboarding.",
        severity: "critical",
    },
    {
        title: "11 clientes com risco de cancelamento",
        description: "Baixa frequência de login, estoque parado e ausência de integrações ativas puxam o risco para cima.",
        severity: "attention",
    },
    {
        title: "Marketplaces sustentam expansão",
        description: "Clientes com ML + OLX ativos retiveram 18% mais MRR do que a média da base.",
        severity: "stable",
    },
];

export const superAdminSections: Record<SuperAdminSectionKey, SuperAdminSection> = {
    financeiro: {
        key: "financeiro",
        label: "Financeiro",
        eyebrow: "",
        title: "Financeiro do IO Auto",
        description: "Leitura diária de receita recorrente, planos, regiões e perda de receita para orientar preço e retenção.",
        spotlight: "Separar receita por porte de revenda mostra onde o pricing precisa evoluir primeiro.",
        metrics: [
            { label: "MRR", value: "R$ 482,4 mil", hint: "Receita recorrente do mês atual", delta: "+8,4% vs mês anterior", tone: "emerald" },
            { label: "ARR", value: "R$ 5,79 mi", hint: "Receita anualizada", delta: "+11,2% em 12 meses", tone: "sky" },
            { label: "Ticket médio", value: "R$ 3.870", hint: "Média por cliente ativo", delta: "+R$ 210 no trimestre", tone: "violet" },
            { label: "LTV", value: "R$ 46,2 mil", hint: "Receita prevista por cliente", delta: "+6,1% em 90 dias", tone: "amber" },
            { label: "Churn", value: "2,1%", hint: "Receita perdida no mês", delta: "-0,4 p.p. vs último mês", tone: "rose" },
        ],
        alerts: [
            { title: "Queda de MRR em pequenas revendas", description: "18 contas com estoque abaixo de 20 carros perderam expansão no mês.", severity: "critical" },
            { title: "Inadimplência subiu", description: "Receita em atraso chegou a R$ 32,6 mil, concentrada em 4 contas enterprise.", severity: "attention" },
            { title: "Cancelamentos sob controle", description: "Apenas 3 cancelamentos no mês, todos com health score abaixo de 45.", severity: "stable" },
        ],
        charts: [
            {
                title: "Crescimento do MRR",
                subtitle: "Linha mensal dos últimos 6 meses",
                type: "line",
                categories: ["Nov", "Dez", "Jan", "Fev", "Mar", "Abr"],
                series: [{ name: "MRR", data: [356, 371, 402, 428, 445, 482], color: "#6b00e3" }],
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            },
            {
                title: "Receita por plano",
                subtitle: "Distribuição por assinatura ativa",
                type: "column",
                categories: ["Start", "Pro", "Scale", "Enterprise"],
                series: [{ name: "Receita", data: [68, 144, 166, 104], color: "#0f172a" }],
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            },
            {
                title: "Receita por região",
                subtitle: "Concentração geográfica da base",
                type: "bar",
                categories: ["Sudeste", "Sul", "Centro-Oeste", "Nordeste", "Norte"],
                series: [{ name: "Receita", data: [238, 96, 74, 52, 22], color: "#14b8a6" }],
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            },
            {
                title: "MRR por porte da revenda",
                subtitle: "Segmentação para apoiar pricing",
                type: "column",
                categories: ["Até 20 carros", "21-50 carros", "51+ carros"],
                series: [{ name: "MRR", data: [88, 171, 223], color: "#f59e0b" }],
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            },
        ],
        statCards: [
            { label: "Receita expansion", value: "R$ 41,8 mil", detail: "Upsell e add-ons contratados em abril." },
            { label: "Receita perdida", value: "R$ 10,3 mil", detail: "Churn financeiro do mês." },
            { label: "Margem de crescimento", value: "64%", detail: "Base ainda com espaço para upgrade de plano." },
        ],
        leaderboardTitle: "Clusters com melhor retorno",
        leaderboard: [
            { name: "Grandes revendas", detail: "51+ carros em estoque", value: "R$ 5,1 mil ticket", badge: "Maior LTV" },
            { name: "Média operação", detail: "21-50 carros", value: "1,8% churn", badge: "Mais estável" },
            { name: "Pequenas revendas", detail: "Até 20 carros", value: "14% inadimplência", badge: "Revisar preço" },
        ],
        insights: [
            { title: "Pricing orientado por porte", description: "O spread entre ticket de pequenas e grandes revendas mostra espaço para uma nova escada de planos.", tone: "positive" },
            { title: "Cobrar antes do risco crescer", description: "As contas enterprise atrasadas concentram 41% da receita vencida e precisam de playbook manual.", tone: "warning" },
            { title: "Cancelar virou evento detectável", description: "Todas as contas canceladas passaram por queda de uso, inadimplência e baixa integração no ciclo anterior.", tone: "positive" },
        ],
    },
    clientes: {
        key: "clientes",
        label: "Clientes",
        eyebrow: "Saúde da base",
        title: "Clientes e retenção",
        description: "Leitura da base de revendas com foco em churn, permanência, distribuição regional e risco de cancelamento.",
        spotlight: "O health score vira o melhor radar operacional para retenção antes da receita escorrer.",
        metrics: [
            { label: "Clientes ativos", value: "126", hint: "Revendas em operação", delta: "+7 no mês", tone: "emerald" },
            { label: "Novos clientes", value: "14", hint: "Entradas em abril", delta: "+3 vs março", tone: "sky" },
            { label: "Cancelados", value: "3", hint: "Saídas confirmadas no mês", delta: "-2 vs média trimestral", tone: "rose" },
            { label: "Taxa de churn", value: "2,3%", hint: "Clientes perdidos sobre base ativa", delta: "-0,8 p.p.", tone: "violet" },
            { label: "Permanência média", value: "14,8 meses", hint: "Tempo médio de contrato", delta: "+1,2 meses", tone: "amber" },
        ],
        alerts: [
            { title: "14 revendas com uso em queda", description: "Sem login frequente nos últimos 10 dias e estoque desatualizado.", severity: "critical" },
            { title: "Plano Start exige onboarding", description: "Clientes do plano inicial demoram 2x mais para conectar o segundo canal.", severity: "attention" },
            { title: "Sul com churn mais baixo", description: "A região registrou retenção 6 p.p. acima da média da base.", severity: "stable" },
        ],
        charts: [
            {
                title: "Evolução da base ativa",
                subtitle: "Entradas e saídas nos últimos 6 meses",
                type: "area",
                categories: ["Nov", "Dez", "Jan", "Fev", "Mar", "Abr"],
                series: [
                    { name: "Ativos", data: [92, 96, 104, 111, 119, 126], color: "#6b00e3" },
                    { name: "Novos", data: [9, 7, 12, 10, 11, 14], color: "#10b981" },
                ],
            },
            {
                title: "Clientes por região",
                subtitle: "Concentração operacional",
                type: "bar",
                categories: ["Sudeste", "Sul", "Centro-Oeste", "Nordeste", "Norte"],
                series: [{ name: "Clientes", data: [57, 24, 18, 17, 10], color: "#0f172a" }],
            },
            {
                title: "Distribuição por estoque",
                subtitle: "Segmentação por tamanho da operação",
                type: "column",
                categories: ["Até 20", "21-50", "51+"],
                series: [{ name: "Clientes", data: [41, 49, 36], color: "#f97316" }],
            },
            {
                title: "Mix por plano",
                subtitle: "Composição da base recorrente",
                type: "pie",
                categories: ["Start", "Pro", "Scale", "Enterprise"],
                series: [{ name: "Clientes", data: [34, 46, 31, 15] }],
                pieColors: ["#6b00e3", "#0f172a", "#14b8a6", "#f59e0b"],
            },
        ],
        statCards: [
            { label: "Health score médio", value: "78/100", detail: "Login frequente e estoque atualizado puxam a média para cima." },
            { label: "Clientes sem login 7+ dias", value: "18", detail: "Fila imediata para CS e operação comercial." },
            { label: "Integrações ativas", value: "84%", detail: "Clientes com pelo menos 1 marketplace conectado." },
        ],
        leaderboardTitle: "Fila de risco e expansão",
        leaderboard: [
            { name: "Auto Vale", detail: "Health 39 | sem login há 11 dias", value: "Risco alto", badge: "Acionar CS" },
            { name: "Prime Motors", detail: "Health 92 | 3 canais conectados", value: "Pronta para upsell", badge: "Upgrade" },
            { name: "Rua 13 Seminovos", detail: "Health 44 | estoque parado", value: "Risco médio", badge: "Treinamento" },
        ],
        insights: [
            { title: "Health score já explica churn", description: "As contas abaixo de 50 pontos concentram toda a perda de clientes dos últimos 90 dias.", tone: "positive" },
            { title: "A região importa no playbook", description: "Nordeste e Centro-Oeste respondem melhor a onboarding consultivo do que a automação pura.", tone: "warning" },
            { title: "Plano Start precisa provar valor rápido", description: "Quando a segunda integração não entra até o dia 15, o risco de cancelamento sobe muito.", tone: "critical" },
        ],
    },
    produto: {
        key: "produto",
        label: "Produto",
        eyebrow: "Uso da plataforma",
        title: "Uso real do produto",
        description: "Mede o quanto o IO Auto está virando rotina operacional nas revendas e quais features realmente geram valor.",
        spotlight: "Essa visão separa feature bonita de feature que segura MRR.",
        metrics: [
            { label: "Veículos cadastrados", value: "6.482", hint: "Base total de estoque", delta: "+412 no mês", tone: "emerald" },
            { label: "Média", value: "51,4", hint: "Veículos por revenda", delta: "+2,8 vs mês anterior", tone: "sky" },
            { label: "Anúncios ativos", value: "18.304", hint: "Publicações em marketplaces", delta: "+9,7% mensal", tone: "violet" },
            { label: "Integrações ativas", value: "267", hint: "Conexões com canais externos", delta: "+21 no mês", tone: "amber" },
            { label: "Adoção de relatórios", value: "36%", hint: "Clientes que usam o módulo", delta: "+4 p.p.", tone: "rose" },
        ],
        alerts: [
            { title: "Relatórios seguem frios", description: "Menos da metade da base abriu o módulo no último mês.", severity: "attention" },
            { title: "Site próprio aumenta permanência", description: "Clientes com site ativo ficam 22% mais tempo na plataforma.", severity: "stable" },
            { title: "Cadastro manual derruba engajamento", description: "Revendas sem importação inicial demoram mais para ganhar tração.", severity: "critical" },
        ],
        charts: [
            {
                title: "Uso por feature",
                subtitle: "Clientes ativos por módulo principal",
                type: "bar",
                categories: ["Marketplaces", "Site próprio", "Financeiro", "Relatórios", "CRM"],
                series: [{ name: "Clientes", data: [106, 82, 64, 45, 58], color: "#6b00e3" }],
            },
            {
                title: "Veículos por cliente",
                subtitle: "Média por porte da operação",
                type: "column",
                categories: ["Start", "Pro", "Scale", "Enterprise"],
                series: [{ name: "Média de veículos", data: [18, 33, 61, 94], color: "#0f172a" }],
            },
            {
                title: "Participação das integrações",
                subtitle: "Canais mais conectados da plataforma",
                type: "pie",
                categories: ["Mercado Livre", "OLX", "Webmotors", "iCarros"],
                series: [{ name: "Integrações", data: [108, 84, 49, 26] }],
                pieColors: ["#f59e0b", "#6b00e3", "#14b8a6", "#0f172a"],
            },
            {
                title: "Adoção de produto ao longo do onboarding",
                subtitle: "Clientes com 1, 2 ou 3 módulos ativos",
                type: "line",
                categories: ["Semana 1", "Semana 2", "Semana 3", "Semana 4", "Semana 5", "Semana 6"],
                series: [
                    { name: "1 módulo", data: [64, 48, 33, 24, 16, 10], color: "#94a3b8" },
                    { name: "2 módulos", data: [22, 34, 41, 46, 44, 40], color: "#14b8a6" },
                    { name: "3+ módulos", data: [4, 11, 19, 28, 36, 42], color: "#6b00e3" },
                ],
            },
        ],
        statCards: [
            { label: "Clientes com 3+ módulos", value: "42", detail: "Essa faixa retém melhor e expande com mais facilidade." },
            { label: "Estoque atualizado em 7 dias", value: "71%", detail: "Bom termômetro de uso operacional real." },
            { label: "Site próprio ativo", value: "58 revendas", detail: "Grupo com melhor combinação de LTV e retenção." },
        ],
        leaderboardTitle: "O que mais gera valor",
        leaderboard: [
            { name: "Marketplaces conectados", detail: "Alta correlação com leads e renovação", value: "Impacto alto", badge: "Core" },
            { name: "Site próprio", detail: "Melhora autoridade e recorrência", value: "Retenção +22%", badge: "Diferencial" },
            { name: "Relatórios", detail: "Baixa frequência de uso", value: "Adoção 36%", badge: "Revisar UX" },
        ],
        insights: [
            { title: "Integração ganha da interface", description: "Quando o dado entra automatizado, a revenda percebe valor e volta mais vezes ao produto.", tone: "positive" },
            { title: "Relatórios precisam de gatilho operacional", description: "O módulo parece útil, mas não está conectado a um ritual claro da revenda.", tone: "warning" },
            { title: "Onboarding com importação deveria virar padrão", description: "Clientes que sobem estoque no dia 1 ativam o dobro de features nas 2 semanas seguintes.", tone: "critical" },
        ],
    },
    marketplaces: {
        key: "marketplaces",
        label: "Marketplaces",
        eyebrow: "Diferencial do IO Auto",
        title: "Marketplaces e canais",
        description: "Visão dedicada para anúncios, leads e performance por plataforma conectada.",
        spotlight: "Essa camada mostra qual canal realmente move estoque e qual só gera trabalho.",
        metrics: [
            { label: "Anúncios publicados", value: "18.304", hint: "Total ativo em canais externos", delta: "+1.612 no mês", tone: "emerald" },
            { label: "Mercado Livre", value: "7.420", hint: "Maior volume de anúncios", delta: "+8,1%", tone: "amber" },
            { label: "OLX", value: "5.380", hint: "Segundo maior canal", delta: "+6,4%", tone: "violet" },
            { label: "Webmotors", value: "3.144", hint: "Canal premium", delta: "+10,2%", tone: "sky" },
            { label: "Leads mensais", value: "1.248", hint: "Origem integrada", delta: "+14,7%", tone: "rose" },
        ],
        alerts: [
            { title: "Webmotors converte melhor", description: "Menor volume, mas maior taxa de fechamento entre os canais premium.", severity: "stable" },
            { title: "iCarros tem baixa tração", description: "ROI estimado e resposta comercial estão abaixo da média.", severity: "attention" },
            { title: "OLX sem resposta rápida perde lead", description: "Quando o primeiro contato passa de 20 min, a chance de resposta cai forte.", severity: "critical" },
        ],
        charts: [
            {
                title: "Anúncios por plataforma",
                subtitle: "Volume atual publicado",
                type: "column",
                categories: ["Mercado Livre", "OLX", "Webmotors", "iCarros"],
                series: [{ name: "Anúncios", data: [7420, 5380, 3144, 2360], color: "#6b00e3" }],
            },
            {
                title: "Leads por plataforma",
                subtitle: "Volume mensal integrado",
                type: "bar",
                categories: ["Mercado Livre", "OLX", "Webmotors", "iCarros"],
                series: [{ name: "Leads", data: [402, 356, 291, 199], color: "#0f172a" }],
            },
            {
                title: "Performance relativa por canal",
                subtitle: "Índice composto de resposta e fechamento",
                type: "line",
                categories: ["Mercado Livre", "OLX", "Webmotors", "iCarros"],
                series: [{ name: "Score", data: [74, 68, 82, 57], color: "#14b8a6" }],
                valueSuffix: " pts",
            },
            {
                title: "ROI estimado por canal",
                subtitle: "Leitura futura para expansão do módulo",
                type: "pie",
                categories: ["Mercado Livre", "OLX", "Webmotors", "iCarros"],
                series: [{ name: "ROI", data: [34, 28, 26, 12] }],
                pieColors: ["#f59e0b", "#6b00e3", "#14b8a6", "#94a3b8"],
            },
        ],
        statCards: [
            { label: "Canal com maior venda por cliente", value: "Webmotors", detail: "Maior valor percebido em contas premium." },
            { label: "Tempo médio de resposta", value: "17 min", detail: "Indicador que altera diretamente a conversão do lead." },
            { label: "Clientes multicanal", value: "63", detail: "Revendas com 2 ou mais canais ativos." },
        ],
        leaderboardTitle: "Leituras por canal",
        leaderboard: [
            { name: "Webmotors", detail: "Melhor taxa de fechamento", value: "18,4%", badge: "Premium" },
            { name: "Mercado Livre", detail: "Maior volume absoluto", value: "402 leads", badge: "Escala" },
            { name: "iCarros", detail: "Menor retorno atual", value: "12% ROI", badge: "Revisar" },
        ],
        insights: [
            { title: "Volume não é tudo", description: "Mercado Livre gera a maior entrada, mas Webmotors entrega os leads mais qualificados.", tone: "positive" },
            { title: "OLX pede disciplina comercial", description: "A operação comercial precisa de SLA curto para o canal sustentar ROI.", tone: "warning" },
            { title: "ROI por canal precisa virar produto", description: "Essa visão tem potencial claro de venda e de expansão do módulo.", tone: "critical" },
        ],
    },
    crescimento: {
        key: "crescimento",
        label: "Crescimento",
        eyebrow: "Escala",
        title: "Crescimento e aquisição",
        description: "Acompanha leads, conversão, CAC, payback e origem dos clientes para orientar onde acelerar.",
        spotlight: "Quando indicação cresce mais que tráfego pago, você ganha CAC melhor e uma história de produto mais forte.",
        metrics: [
            { label: "Leads gerados", value: "342", hint: "Leads comerciais no mês", delta: "+16% mensal", tone: "emerald" },
            { label: "Conversão", value: "18,6%", hint: "Lead para cliente ativo", delta: "+2,1 p.p.", tone: "sky" },
            { label: "CAC", value: "R$ 740", hint: "Custo médio por aquisição", delta: "-R$ 55", tone: "violet" },
            { label: "Payback", value: "3,2 meses", hint: "Retorno do investimento comercial", delta: "-0,4 mês", tone: "amber" },
            { label: "Indicações", value: "38%", hint: "Origem dos clientes do mês", delta: "+9 p.p.", tone: "rose" },
        ],
        alerts: [
            { title: "Indicação virou o motor mais barato", description: "Canal com melhor conversão e menor CAC no trimestre.", severity: "stable" },
            { title: "Parceiros estagnados", description: "Aquisição via parceiros caiu pelo segundo mês consecutivo.", severity: "attention" },
            { title: "Tráfego pago ainda caro", description: "CAC segue acima do target nas campanhas de pesquisa.", severity: "critical" },
        ],
        charts: [
            {
                title: "Origem dos clientes",
                subtitle: "Mix de aquisição do mês",
                type: "pie",
                categories: ["Indicação", "Tráfego pago", "Orgânico", "Parceiros"],
                series: [{ name: "Clientes", data: [38, 27, 21, 14] }],
                pieColors: ["#6b00e3", "#f59e0b", "#0f172a", "#14b8a6"],
            },
            {
                title: "Funil comercial",
                subtitle: "Etapas da aquisição",
                type: "column",
                categories: ["Leads", "SQLs", "Demos", "Propostas", "Fechamentos"],
                series: [{ name: "Volume", data: [342, 196, 122, 78, 64], color: "#6b00e3" }],
            },
            {
                title: "CAC por canal",
                subtitle: "Comparativo de eficiência",
                type: "bar",
                categories: ["Indicação", "Orgânico", "Parceiros", "Tráfego pago"],
                series: [{ name: "CAC", data: [210, 420, 610, 1110], color: "#0f172a" }],
                valuePrefix: "R$ ",
            },
            {
                title: "Payback por coorte",
                subtitle: "Últimos 4 meses de aquisição",
                type: "line",
                categories: ["Jan", "Fev", "Mar", "Abr"],
                series: [{ name: "Meses", data: [4.2, 3.9, 3.5, 3.2], color: "#14b8a6" }],
                valueSuffix: " m",
            },
        ],
        statCards: [
            { label: "Canal com melhor conversão", value: "Indicação", detail: "27% de conversão em clientes ativos." },
            { label: "MQL para demo", value: "62%", detail: "Saúde boa do topo de funil atual." },
            { label: "Pipeline aberto", value: "R$ 214 mil", detail: "Receita potencial em propostas enviadas." },
        ],
        leaderboardTitle: "Onde escalar primeiro",
        leaderboard: [
            { name: "Indicação", detail: "Melhor CAC e melhor conversão", value: "27% conv.", badge: "Escalar" },
            { name: "Orgânico", detail: "Canal previsível e saudável", value: "R$ 420 CAC", badge: "Consistente" },
            { name: "Tráfego pago", detail: "Mais caro do que deveria", value: "R$ 1.110 CAC", badge: "Otimizar" },
        ],
        insights: [
            { title: "O módulo de indicações encaixa aqui perfeitamente", description: "A origem mais barata já está provando valor e merece instrumentação dedicada.", tone: "positive" },
            { title: "Pago não precisa parar, precisa afinar", description: "Há espaço para segmentação melhor antes de cortar investimento.", tone: "warning" },
            { title: "Payback abaixo de 4 meses abre margem para ousar", description: "Com melhor origem de leads, a empresa pode reinvestir em crescimento com mais segurança.", tone: "positive" },
        ],
    },
    cobranca: {
        key: "cobranca",
        label: "Cobrança",
        eyebrow: "Proteção de receita",
        title: "Cobrança e inadimplência",
        description: "Acompanha atrasos, falhas de pagamento e clientes inadimplentes para proteger caixa e recorrência.",
        spotlight: "Muita empresa SaaS cresce e mesmo assim sangra aqui; essa tela evita isso.",
        metrics: [
            { label: "Inadimplentes", value: "11", hint: "Contas em atraso ativas", delta: "+2 vs semana passada", tone: "rose" },
            { label: "Receita em atraso", value: "R$ 32,6 mil", hint: "Valor total vencido", delta: "+R$ 6,4 mil", tone: "amber" },
            { label: "Atraso médio", value: "8,4 dias", hint: "Tempo médio até regularização", delta: "-1,3 dia", tone: "sky" },
            { label: "Falha de pagamento", value: "4,7%", hint: "Tentativas recusadas no mês", delta: "+0,8 p.p.", tone: "violet" },
            { label: "Recuperação 7 dias", value: "61%", hint: "Receita vencida recuperada em até uma semana", delta: "+5 p.p.", tone: "emerald" },
        ],
        alerts: [
            { title: "4 cartões recusados em contas enterprise", description: "Impacto alto de receita, precisa ação manual no mesmo dia.", severity: "critical" },
            { title: "Boletos vencidos no plano Start", description: "Atraso recorrente em pequenas revendas tende a anteceder churn.", severity: "attention" },
            { title: "Playbook de cobrança melhorou a recuperação", description: "A taxa de regularização em 7 dias subiu acima de 60%.", severity: "stable" },
        ],
        charts: [
            {
                title: "Envelhecimento da carteira vencida",
                subtitle: "Faixas de atraso",
                type: "column",
                categories: ["1-3 dias", "4-7 dias", "8-15 dias", "16-30 dias", "30+ dias"],
                series: [{ name: "Receita", data: [9.4, 7.8, 6.1, 5.7, 3.6], color: "#6b00e3" }],
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            },
            {
                title: "Falhas por método",
                subtitle: "Onde a cobrança trava",
                type: "bar",
                categories: ["Cartão", "Boleto", "Pix recorrente"],
                series: [{ name: "Falhas", data: [17, 12, 4], color: "#0f172a" }],
            },
            {
                title: "Receita recuperada",
                subtitle: "Últimas 6 semanas",
                type: "line",
                categories: ["S1", "S2", "S3", "S4", "S5", "S6"],
                series: [{ name: "Recuperada", data: [8, 11, 13, 15, 18, 20], color: "#10b981" }],
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            },
            {
                title: "Status da carteira",
                subtitle: "Distribuição das contas cobradas",
                type: "pie",
                categories: ["Regularizada", "Em contato", "Crítica", "Bloqueio"],
                series: [{ name: "Carteira", data: [61, 23, 10, 6] }],
                pieColors: ["#10b981", "#f59e0b", "#ef4444", "#0f172a"],
            },
        ],
        statCards: [
            { label: "Maior saldo vencido", value: "R$ 7,2 mil", detail: "Uma conta enterprise concentra a maior exposição do mês." },
            { label: "Reprocessamentos automatizados", value: "19", detail: "Tentativas extras que evitaram churn involuntário." },
            { label: "Contas no limite de bloqueio", value: "3", detail: "Precisa decisão comercial e financeira conjunta." },
        ],
        leaderboardTitle: "Prioridade de cobrança",
        leaderboard: [
            { name: "Grupo Delta Motors", detail: "12 dias de atraso | plano enterprise", value: "R$ 7,2 mil", badge: "Ação hoje" },
            { name: "Auto Prime", detail: "2 recusas de cartão na semana", value: "R$ 3,4 mil", badge: "Reprocessar" },
            { name: "Seminovos do Vale", detail: "Boleto recorrente vencido", value: "R$ 1,1 mil", badge: "Contato CS" },
        ],
        insights: [
            { title: "Cobrar rápido evita churn acidental", description: "Boa parte das falhas ainda é operacional, não decisão de cancelamento.", tone: "positive" },
            { title: "Enterprise merece fila manual", description: "Poucas contas concentram muito risco financeiro, então vale tratamento personalizado.", tone: "warning" },
            { title: "Plano Start precisa política simples", description: "Pequenos atrasos somados viram ruído operacional e distorcem leitura de churn.", tone: "critical" },
        ],
    },
    operacional: {
        key: "operacional",
        label: "Operacional",
        eyebrow: "Operação interna IO",
        title: "Operação interna",
        description: "Painel interno para suporte, resolução e bugs, com foco em velocidade e gargalos do time.",
        spotlight: "Quase ninguém faz essa leitura no SaaS; quem faz opera melhor e retenção agradece.",
        metrics: [
            { label: "Tickets abertos", value: "23", hint: "Fila atual de suporte", delta: "-5 vs ontem", tone: "emerald" },
            { label: "Resposta média", value: "18 min", hint: "Primeiro toque do time", delta: "-7 min na semana", tone: "sky" },
            { label: "Resolução média", value: "6,4 h", hint: "Tempo até encerrar", delta: "-1,1 h", tone: "violet" },
            { label: "Bugs reportados", value: "9", hint: "Incidentes ativos", delta: "+2 desde sexta", tone: "amber" },
            { label: "SLA cumprido", value: "93%", hint: "Atendimentos dentro do alvo", delta: "+4 p.p.", tone: "rose" },
        ],
        alerts: [
            { title: "Fila de bugs nas integrações", description: "5 dos 9 bugs ativos estão ligados a publicação ou retorno de canal.", severity: "critical" },
            { title: "Suporte responde bem cedo", description: "Primeira resposta já opera abaixo do target interno.", severity: "stable" },
            { title: "Resolução sobe em contas enterprise", description: "Tickets mais complexos ainda puxam a média para cima.", severity: "attention" },
        ],
        charts: [
            {
                title: "Volume de tickets",
                subtitle: "Últimos 7 dias",
                type: "line",
                categories: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"],
                series: [{ name: "Tickets", data: [18, 22, 27, 24, 31, 14, 9], color: "#6b00e3" }],
            },
            {
                title: "Bugs por categoria",
                subtitle: "Onde a equipe está sofrendo mais",
                type: "bar",
                categories: ["Marketplaces", "Financeiro", "CRM", "Login", "Catálogo"],
                series: [{ name: "Bugs", data: [5, 1, 1, 1, 1], color: "#0f172a" }],
            },
            {
                title: "SLA por fila",
                subtitle: "Comparativo do atendimento",
                type: "column",
                categories: ["Suporte N1", "Suporte técnico", "Onboarding", "Financeiro"],
                series: [{ name: "SLA", data: [96, 89, 94, 92], color: "#14b8a6" }],
                valueSuffix: "%",
            },
            {
                title: "Tempo médio de resolução",
                subtitle: "Últimas 6 semanas",
                type: "area",
                categories: ["S1", "S2", "S3", "S4", "S5", "S6"],
                series: [{ name: "Horas", data: [8.1, 7.4, 7.2, 6.8, 6.6, 6.4], color: "#f59e0b" }],
                valueSuffix: " h",
            },
        ],
        statCards: [
            { label: "Fila crítica", value: "5 tickets", detail: "Todos ligados a publicação ou integração com canal." },
            { label: "CSAT interno", value: "94%", detail: "Clientes atendidos seguem avaliando bem o suporte." },
            { label: "Onboarding em andamento", value: "8 contas", detail: "Pico bom para coordenar suporte preventivo." },
        ],
        leaderboardTitle: "Prioridades operacionais",
        leaderboard: [
            { name: "Integrações", detail: "Maior concentração de bugs", value: "5 incidentes", badge: "Prioridade 1" },
            { name: "Suporte técnico", detail: "Maior tempo médio", value: "8,2 h", badge: "Ajustar fila" },
            { name: "Onboarding", detail: "Melhor SLA da semana", value: "94%", badge: "Benchmark" },
        ],
        insights: [
            { title: "Tempo de resposta já não é gargalo", description: "O problema está mais em bugs concentrados do que na triagem inicial.", tone: "positive" },
            { title: "Integração merece observabilidade", description: "Boa parte do ruído operacional vem de canais externos e precisa de monitoramento próprio.", tone: "warning" },
            { title: "SLA interno é ativo comercial", description: "Operação rápida vira argumento de retenção nas contas de maior valor.", tone: "positive" },
        ],
    },
    insights: {
        key: "insights",
        label: "Insights",
        eyebrow: "Nível avançado",
        title: "Insights automáticos",
        description: "Camada premium do backoffice com leitura acionável de churn, upgrade, potencial de receita e subutilização.",
        spotlight: "Aqui o sistema deixa de mostrar número e começa a sugerir decisão.",
        metrics: [
            { label: "Risco alto de churn", value: "11 contas", hint: "Probabilidade acima de 70%", delta: "+3 na semana", tone: "rose" },
            { label: "Prontas para upgrade", value: "19 contas", hint: "Uso acima do plano atual", delta: "+5 no mês", tone: "emerald" },
            { label: "Potencial adicional", value: "R$ 58 mil", hint: "Receita estimada de expansão", delta: "+R$ 12 mil", tone: "sky" },
            { label: "Features subutilizadas", value: "4 módulos", hint: "Adoção abaixo do alvo", delta: "2 pedem ação rápida", tone: "amber" },
            { label: "Confiança do modelo", value: "82%", hint: "Índice médio das recomendações", delta: "+4 p.p.", tone: "violet" },
        ],
        alerts: [
            { title: "Upgrade escondido nas contas Scale", description: "Revendas com alto volume e site próprio ativo já estão batendo teto do plano.", severity: "stable" },
            { title: "Churn previsível em contas frias", description: "Sem login + estoque parado + falha de cobrança continuam sendo o trio mais sensível.", severity: "critical" },
            { title: "Relatórios aparecem como oportunidade", description: "Feature com boa percepção potencial e adoção ainda baixa.", severity: "attention" },
        ],
        charts: [
            {
                title: "Probabilidade de churn por cluster",
                subtitle: "Leitura dos grupos mais sensíveis",
                type: "bar",
                categories: ["Start frio", "Start ativo", "Scale com atraso", "Enterprise engajado"],
                series: [{ name: "Risco", data: [81, 42, 67, 18], color: "#ef4444" }],
                valueSuffix: "%",
            },
            {
                title: "Oportunidades por categoria",
                subtitle: "Mapa das recomendações",
                type: "pie",
                categories: ["Upgrade", "Cross-sell", "Churn evitado", "Reativação"],
                series: [{ name: "Oportunidades", data: [34, 27, 22, 17] }],
                pieColors: ["#10b981", "#6b00e3", "#f59e0b", "#0f172a"],
            },
            {
                title: "Receita potencial por movimento",
                subtitle: "Churn evitado x upgrade x cross-sell",
                type: "column",
                categories: ["Churn evitado", "Upgrade", "Cross-sell", "Reativação"],
                series: [{ name: "Potencial", data: [14, 26, 11, 7], color: "#6b00e3" }],
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            },
            {
                title: "Subutilização de features",
                subtitle: "Gap entre contas elegíveis e contas usando",
                type: "line",
                categories: ["Site próprio", "Financeiro", "Relatórios", "CRM"],
                series: [{ name: "Gap", data: [14, 21, 39, 18], color: "#f59e0b" }],
                valueSuffix: " contas",
            },
        ],
        statCards: [
            { label: "Conta com maior chance de upgrade", value: "Prime Motors", detail: "Uso acima do plano e multicanal forte." },
            { label: "Conta com maior risco", value: "Auto Vale", detail: "Sem login, atraso e uso de apenas 1 módulo." },
            { label: "Maior ganho rápido", value: "Relatórios", detail: "Feature com maior diferença entre elegíveis e adoção real." },
        ],
        leaderboardTitle: "Lista priorizada",
        leaderboard: [
            { name: "Prime Motors", detail: "Health 92 | 87 veículos | 3 canais", value: "Upgrade imediato", badge: "Revenue" },
            { name: "Auto Vale", detail: "Health 39 | atraso 12 dias", value: "Churn provável", badge: "Salvar" },
            { name: "Vila Cars", detail: "Financeiro desligado | relatórios inativos", value: "Cross-sell", badge: "Adoção" },
        ],
        insights: [
            { title: "A IA aqui precisa virar fila operacional", description: "Não basta prever; o time precisa receber essas recomendações como tarefa acionável.", tone: "critical" },
            { title: "Upgrade é mais fácil que aquisição nova", description: "As contas certas já mostram comportamento de expansão e podem baratear crescimento.", tone: "positive" },
            { title: "Feature subutilizada é receita escondida", description: "Quando a adoção sobe, o produto prova mais valor e a retenção tende a acompanhar.", tone: "warning" },
        ],
    },
    planos: {
        key: "planos",
        label: "Planos",
        eyebrow: "Catalogo comercial",
        title: "Gestao de planos",
        description: "Configure os planos oficiais do IO Auto com limites, recursos e regras reais aplicadas no backend.",
        spotlight: "Tudo o que for salvo aqui passa a governar o acesso das empresas aos modulos e limites contratados.",
        metrics: [],
        alerts: [],
        charts: [],
        statCards: [],
        leaderboardTitle: "",
        leaderboard: [],
        insights: [],
    },
    tenants: {
        key: "tenants",
        label: "Tenants",
        eyebrow: "Coração operacional",
        title: "Gestão de contas",
        description: "Lista central de empresas com contexto de plano, status, acesso recente e MRR individual para operação interna.",
        spotlight: "Essa tela foi pensada para o dia a dia do time IO Auto, com foco em agir rápido na conta certa.",
        metrics: [
            { label: "Tenants monitorados", value: "126", hint: "Contas ativas na carteira", delta: "+7 no mês", tone: "emerald" },
            { label: "Contas recentes", value: "9", hint: "Entradas nos últimos 30 dias", delta: "+2 na semana", tone: "sky" },
            { label: "MRR mapeado", value: "R$ 482,4 mil", hint: "Receita distribuída entre tenants", delta: "100% visível", tone: "violet" },
            { label: "Acesso recente", value: "78%", hint: "Empresas com login em até 72h", delta: "-4 p.p.", tone: "amber" },
            { label: "Contas bloqueáveis", value: "3", hint: "Atraso e risco operacional", delta: "Revisar hoje", tone: "rose" },
        ],
        alerts: [
            { title: "Impersonação ainda depende de endpoint dedicado", description: "A interface já está pronta para receber o fluxo seguro de entrar como admin da conta.", severity: "attention" },
            { title: "Último acesso virou prioridade operacional", description: "Contas sem login recente aparecem no topo da fila para reativação.", severity: "stable" },
            { title: "Contas recentes com ativação fraca", description: "Se não conectarem canal até a primeira semana, o risco operacional cresce rápido.", severity: "critical" },
        ],
        charts: [
            {
                title: "Tenants por status",
                subtitle: "Distribuição da carteira",
                type: "pie",
                categories: ["Ativo", "Em atenção", "Cancelado", "Bloqueado"],
                series: [{ name: "Tenants", data: [108, 9, 6, 3] }],
                pieColors: ["#10b981", "#f59e0b", "#94a3b8", "#ef4444"],
            },
            {
                title: "MRR por faixa de conta",
                subtitle: "Distribuição de valor",
                type: "column",
                categories: ["Até R$ 2k", "R$ 2k-5k", "R$ 5k-10k", "R$ 10k+"],
                series: [{ name: "Contas", data: [32, 44, 31, 19], color: "#6b00e3" }],
            },
            {
                title: "Último acesso por janela",
                subtitle: "Frequência recente da base",
                type: "bar",
                categories: ["0-3 dias", "4-7 dias", "8-14 dias", "15+ dias"],
                series: [{ name: "Empresas", data: [98, 16, 7, 5], color: "#0f172a" }],
            },
            {
                title: "Ativação de contas recentes",
                subtitle: "Coortes de entrada mais novas",
                type: "line",
                categories: ["Jan", "Fev", "Mar", "Abr"],
                series: [{ name: "Ativação", data: [41, 44, 52, 49], color: "#14b8a6" }],
                valueSuffix: "%",
            },
        ],
        statCards: [
            { label: "Conta com maior MRR", value: "Grupo Delta Motors", detail: "R$ 12,8 mil e 4 operações conectadas." },
            { label: "Conta mais engajada", value: "Prime Motors", detail: "Login diário e 5 módulos ativos." },
            { label: "Conta em observação", value: "Auto Vale", detail: "Sem login há 11 dias e health score em queda." },
        ],
        leaderboardTitle: "Fila operacional das contas",
        leaderboard: [
            { name: "Prime Motors", detail: "Scale | último acesso hoje", value: "R$ 6,4 mil", badge: "Expandir" },
            { name: "Auto Vale", detail: "Start | sem login há 11 dias", value: "R$ 1,2 mil", badge: "Risco" },
            { name: "Grupo Delta Motors", detail: "Enterprise | atraso recorrente", value: "R$ 12,8 mil", badge: "Financeiro" },
        ],
        insights: [
            { title: "Tenants precisam juntar produto e operação", description: "Plano, acesso recente e MRR lado a lado aceleram decisão do time interno.", tone: "positive" },
            { title: "Entrar como admin é o próximo passo óbvio", description: "A UX já está pronta; falta apenas o backend seguro de impersonação.", tone: "critical" },
            { title: "Último acesso é o melhor atalho visual", description: "Esse campo ajuda a separar problema comercial, operacional ou de cobrança.", tone: "warning" },
        ],
    },
    configuracoes: {
        key: "configuracoes",
        label: "Configurações",
        eyebrow: "Ajustes globais",
        title: "Configurações do superadmin",
        description: "Centralize contatos e preferências usadas pelos fluxos administrativos e públicos do sistema.",
        spotlight: "Um ajuste salvo aqui passa a servir a experiência de bloqueio, suporte e comunicação institucional.",
        metrics: [],
        alerts: [],
        charts: [],
        statCards: [],
        leaderboardTitle: "",
        leaderboard: [],
        insights: [],
    },
};

export type SuperAdminTenantRow = {
    id: string;
    name: string;
    plan: string;
    status: "ativo" | "atencao" | "cancelado" | "bloqueado";
    entryDate: string;
    lastAccess: string;
    mrr: string;
    note: string;
};

export const superAdminTenantSeed: SuperAdminTenantRow[] = [
    {
        id: "tenant-prime-motors",
        name: "Prime Motors",
        plan: "Scale",
        status: "ativo",
        entryDate: "2025-08-14",
        lastAccess: "Hoje, 08:12",
        mrr: "R$ 6.400",
        note: "Conta pronta para upgrade de add-ons.",
    },
    {
        id: "tenant-auto-vale",
        name: "Auto Vale",
        plan: "Start",
        status: "ativo",
        entryDate: "2025-12-02",
        lastAccess: "Há 11 dias",
        mrr: "R$ 1.200",
        note: "Baixo uso e risco de cancelamento.",
    },
    {
        id: "tenant-delta-motors",
        name: "Grupo Delta Motors",
        plan: "Enterprise",
        status: "bloqueado",
        entryDate: "2024-11-19",
        lastAccess: "Ontem, 19:40",
        mrr: "R$ 12.800",
        note: "Maior MRR da base e cobrança sensível.",
    },
    {
        id: "tenant-rua-13",
        name: "Rua 13 Seminovos",
        plan: "Pro",
        status: "atencao",
        entryDate: "2026-04-12",
        lastAccess: "Há 2 dias",
        mrr: "R$ 2.100",
        note: "Conta recente com apenas uma integração ativa.",
    },
    {
        id: "tenant-vila-cars",
        name: "Vila Cars",
        plan: "Pro",
        status: "ativo",
        entryDate: "2025-05-09",
        lastAccess: "Hoje, 07:31",
        mrr: "R$ 2.850",
        note: "Boa candidata para cross-sell do financeiro.",
    },
];
