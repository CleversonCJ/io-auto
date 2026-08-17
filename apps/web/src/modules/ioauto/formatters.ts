const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateValue(value?: string | null) {
    if (!value) return null;

    if (DATE_ONLY_PATTERN.test(value)) {
        const [year, month, day] = value.split("-").map(Number);
        const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0);
        if (Number.isNaN(date.getTime())) return null;
        return { date, dateOnly: true };
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return { date, dateOnly: false };
}

export function formatMoney(value?: number | null, currency = "BRL") {
    if (value == null || Number.isNaN(Number(value))) return "-";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency,
    }).format(value / 100);
}

export function formatDateTime(value?: string | null) {
    const parsed = parseDateValue(value);
    if (!parsed) return "-";

    if (parsed.dateOnly) {
        return parsed.date.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    }

    return parsed.date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatShortDate(value?: string | null) {
    const parsed = parseDateValue(value);
    if (!parsed) return "-";

    return parsed.date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export function platformLabel(platform?: string | null) {
    const normalized = String(platform ?? "").trim().toUpperCase();
    if (normalized === "WEBMOTORS") return "Webmotors";
    if (normalized === "ICARROS") return "iCarros";
    if (normalized === "OLX" || normalized === "OLX_AUTOS") return "OLX";
    if (normalized === "MERCADOLIVRE" || normalized === "MERCADO_LIVRE") return "Mercado Livre";
    if (normalized === "PUBLIC_CATALOG" || normalized === "CATALOG") return "Catálogo";
    if (normalized === "FACEBOOK_MARKETPLACE") return "Facebook Marketplace";
    if (!normalized) return "Origem";
    return normalized;
}

export function statusLabel(status?: string | null) {
    const normalized = String(status ?? "").trim().toUpperCase();
    const labels: Record<string, string> = {
        DRAFT: "Rascunho",
        READY: "Pronto",
        PUBLISHED: "Publicado",
        ARCHIVED: "Arquivado",
        NEW: "Novo",
        OPEN: "Aberto",
        IN_PROGRESS: "Em andamento",
        WAITING_CUSTOMER: "Aguardando cliente",
        RESOLVED: "Resolvido",
        CONFIGURATION_REQUIRED: "Configurar",
        CONNECTED: "Conectado",
        ACTIVE: "Ativo",
        BLOCKED: "Bloqueado",
        OVERDUE: "Em atraso",
        PENDING: "Pendente",
        RECEIVED: "Recebido",
        CONFIRMED: "Confirmado",
        FAILED: "Falhou",
        PAYMENT_FAILED: "Falha no pagamento",
        UNPAID: "Não pago",
        READY_TO_SYNC: "Pronto para publicar",
        WAITING_CONFIGURATION: "Aguardando integração",
        ERROR: "Com erro",
        IMPORT_PENDING: "Importando",
        QUEUED: "Na fila",
        ACCEPTED: "Aceito",
        PENDING_REVIEW: "Em revisão",
        REFUSED: "Recusado",
        DELETE_PENDING: "Removendo",
        DELETED: "Removido",
        PAST_DUE: "Pagamento pendente",
        CANCELED: "Cancelada",
        CANCELLED: "Cancelada",
        PENDING_CONFIGURATION: "Configurar assinatura",
        INCOMPLETE: "Em configuração",
        SYNC_QUEUED: "Na fila de sincronização",
        SYNC_IN_PROGRESS: "Sincronizando",
        REMOVED: "Removido",
        SOLD: "Vendido",
        PAUSED: "Pausado",
        CLOSED: "Finalizado",
        UNDER_REVIEW: "Em revisão",
        PAYMENT_REQUIRED: "Pagamento pendente",
        NOT_YET_ACTIVE: "Ainda não ativo",
        INACTIVE: "Inativo",
    };
    return labels[normalized] ?? (normalized ? normalized.replaceAll("_", " ") : "-");
}

export function billingTypeLabel(value?: string | null) {
    const normalized = String(value ?? "").trim().toUpperCase();
    const labels: Record<string, string> = {
        PIX: "Pix",
        CREDIT_CARD: "Cartão de crédito",
        BOLETO: "Boleto",
        UNDEFINED: "Não informado",
    };

    return labels[normalized] ?? (normalized ? normalized.replaceAll("_", " ") : "-");
}

export function billingIntervalLabel(value?: string | null) {
    const normalized = String(value ?? "").trim().toUpperCase();
    const labels: Record<string, string> = {
        MONTHLY: "Mensal",
        QUARTERLY: "Trimestral",
        SEMIANNUALLY: "Semestral",
        ANNUAL: "Anual",
        YEARLY: "Anual",
    };

    return labels[normalized] ?? (normalized ? normalized.replaceAll("_", " ") : "-");
}
