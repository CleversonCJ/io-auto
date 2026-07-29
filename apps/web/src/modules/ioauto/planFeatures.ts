import type { BillingPlanFeatures } from "@/modules/ioauto/types";

export const BILLING_FEATURE_LABELS: Array<{ key: keyof BillingPlanFeatures; label: string }> = [
    { key: "catalogBioLink", label: "Catálogo público" },
    { key: "whatsappSharing", label: "WhatsApp" },
    { key: "storefrontPage", label: "Página da loja" },
    { key: "webmotors", label: "Webmotors" },
    { key: "olx", label: "OLX" },
    { key: "icarros", label: "iCarros" },
    { key: "crmKanban", label: "CRM Kanban" },
    { key: "leadManagement", label: "Gestão de leads" },
    { key: "finance", label: "Financeiro" },
    { key: "reports", label: "Relatórios" },
    { key: "trackableLinks", label: "Links rastreáveis" },
    { key: "multiunits", label: "Multiunidades" },
    { key: "advancedMultiuser", label: "Multiusuário avancado" },
    { key: "executiveDashboard", label: "Dashboard executivo" },
    { key: "integrationsApi", label: "API de integrações" },
    { key: "assistedOnboarding", label: "Implantação assistida" },
    { key: "prioritySupport", label: "Suporte prioritário" },
    { key: "customizations", label: "Personalizações" },
];

export function listEnabledFeatureLabels(features?: BillingPlanFeatures | null) {
    if (!features) return [];
    return BILLING_FEATURE_LABELS
        .filter((item) => Boolean(features[item.key]))
        .map((item) => item.label);
}
