import type { BillingPlanFeatures } from "@/modules/ioauto/types";

export const BILLING_FEATURE_LABELS: Array<{ key: keyof BillingPlanFeatures; label: string }> = [
    { key: "catalogBioLink", label: "Catalogo publico" },
    { key: "whatsappSharing", label: "WhatsApp" },
    { key: "storefrontPage", label: "Pagina da loja" },
    { key: "webmotors", label: "Webmotors" },
    { key: "olx", label: "OLX" },
    { key: "icarros", label: "iCarros" },
    { key: "crmKanban", label: "CRM Kanban" },
    { key: "leadManagement", label: "Gestao de leads" },
    { key: "finance", label: "Financeiro" },
    { key: "reports", label: "Relatorios" },
    { key: "trackableLinks", label: "Links rastreaveis" },
    { key: "multiunits", label: "Multiunidades" },
    { key: "advancedMultiuser", label: "Multiusuario avancado" },
    { key: "executiveDashboard", label: "Dashboard executivo" },
    { key: "integrationsApi", label: "API de integracoes" },
    { key: "assistedOnboarding", label: "Implantacao assistida" },
    { key: "prioritySupport", label: "Suporte prioritario" },
    { key: "customizations", label: "Personalizacoes" },
];

export function listEnabledFeatureLabels(features?: BillingPlanFeatures | null) {
    if (!features) return [];
    return BILLING_FEATURE_LABELS
        .filter((item) => Boolean(features[item.key]))
        .map((item) => item.label);
}
