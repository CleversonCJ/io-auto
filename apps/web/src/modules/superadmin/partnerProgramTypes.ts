export type PartnerMetricPoint = {
    label: string;
    value: number;
};

export type PartnerDecimalMetricPoint = {
    label: string;
    value: number;
};

export type PartnerDashboardSummary = {
    activePartners: number;
    leadsGenerated: number;
    leadsConverted: number;
    conversionRate: number;
    revenueGeneratedCents: number;
    commissionTotalCents: number;
    commissionPaidCents: number;
    commissionPendingCents: number;
};

export type PartnerRow = {
    partnerId: string;
    partnerName: string;
    companyName: string;
    whatsapp: string;
    email: string;
    city: string;
    state: string;
    partnerType: string;
    defaultCommissionBps: number;
    status: string;
    referenceCode: string;
    leadsSent: number;
    salesClosed: number;
    conversionRate: number;
    revenueGeneratedCents: number;
    commissionGeneratedCents: number;
    commissionPaidCents: number;
    commissionPendingCents: number;
    createdAt: string;
    updatedAt: string;
};

export type PartnerLeadRow = {
    leadId: string;
    partnerId: string;
    partnerName: string;
    partnerReferenceCode: string;
    shopkeeperName: string;
    storeName: string;
    whatsapp: string;
    email: string;
    city: string;
    state: string;
    approximateStock?: number | null;
    leadStatus: string;
    salesOwner: string;
    notes: string;
    closedPlan: string;
    firstMonthlyFeeCents?: number | null;
    closedAt?: string | null;
    commissionCents?: number | null;
    commissionStatus: string;
    commissionDueDate?: string | null;
    commissionPaidAt?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type PartnerCommissionRow = {
    leadId: string;
    closedClient: string;
    closedPlan: string;
    firstMonthlyFeeCents?: number | null;
    commissionCents?: number | null;
    status: string;
    commissionDueDate?: string | null;
    closedAt?: string | null;
};

export type PartnerDashboardResponse = {
    summary: PartnerDashboardSummary;
    partners: PartnerRow[];
    leads: PartnerLeadRow[];
    charts: {
        leadsByPartner: PartnerMetricPoint[];
        conversionsByPartner: PartnerMetricPoint[];
        commissionByMonth: PartnerMetricPoint[];
        revenueByPartner: PartnerMetricPoint[];
        conversionRateByPartner: PartnerDecimalMetricPoint[];
        leadsOverTime: PartnerMetricPoint[];
        rankingByRevenue: PartnerMetricPoint[];
    };
};

export type PartnerDetailResponse = {
    partner: PartnerRow;
    leads: PartnerLeadRow[];
    commissions: PartnerCommissionRow[];
    charts: {
        leadsByMonth: PartnerMetricPoint[];
        conversionsByMonth: PartnerMetricPoint[];
        commissionByMonth: PartnerMetricPoint[];
    };
};

export type PublicPartnerResponse = {
    referenceCode: string;
    partnerName: string;
    companyName: string;
};
