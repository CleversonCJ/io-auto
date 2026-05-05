export function formatMoney(value?: number | null, currency = "BRL") {
    if (value == null || Number.isNaN(Number(value))) return "-";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(value / 100);
}

export function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatShortDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
    });
}

export function platformLabel(platform?: string | null) {
    const normalized = String(platform ?? "").trim().toUpperCase();
    if (normalized === "WEBMOTORS") return "Webmotors";
    if (normalized === "ICARROS") return "iCarros";
    if (normalized === "OLX" || normalized === "OLX_AUTOS") return "OLX";
    if (normalized === "MERCADOLIVRE" || normalized === "MERCADO_LIVRE") return "Mercado Livre";
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
        IN_PROGRESS: "Em atendimento",
        CONFIGURATION_REQUIRED: "Configurar",
        CONNECTED: "Conectado",
        ACTIVE: "Ativo",
        READY_TO_SYNC: "Pronto para publicar",
        WAITING_CONFIGURATION: "Aguardando integração",
        ERROR: "Com erro",
        IMPORT_PENDING: "Importando",
        QUEUED: "Na fila",
        ACCEPTED: "Aceito",
        PENDING_REVIEW: "Em revisao",
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
        TRIALING: "Em teste",
    };
    return labels[normalized] ?? (normalized ? normalized.replaceAll("_", " ") : "-");
}
