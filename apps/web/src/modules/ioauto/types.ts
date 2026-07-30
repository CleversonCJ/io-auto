export type BillingPlanFeatures = {
    catalogBioLink: boolean;
    whatsappSharing: boolean;
    storefrontPage: boolean;
    webmotors: boolean;
    olx: boolean;
    icarros: boolean;
    crmKanban: boolean;
    leadManagement: boolean;
    finance: boolean;
    reports: boolean;
    trackableLinks: boolean;
    multiunits: boolean;
    advancedMultiuser: boolean;
    executiveDashboard: boolean;
    integrationsApi: boolean;
    assistedOnboarding: boolean;
    prioritySupport: boolean;
    customizations: boolean;
};

export type BillingPlanUsage = {
    activeUsers: number;
    activeVehicles: number;
    activeAds: number;
    connectedIntegrations: number;
    webmotorsIntegrations: number;
    olxIntegrations: number;
    icarrosIntegrations: number;
    publicLinks: number;
    trackedLinks: number;
    catalogLeads: number;
    publicLeadEvents: number;
    trackedLeadEvents: number;
    financialEntries: number;
    dreSubcategories: number;
    reportEvents: number;
    crmCustomized: boolean;
    storefrontCustomized: boolean;
};

export type BillingPlanOption = {
    planId: string;
    planKey: string;
    planName: string;
    billingRecurrence: string;
    priceCents: number | null;
    monthlyPriceCents: number | null;
    annualPriceCents: number | null;
    priceByInterval: Record<string, number>;
    supportedBillingIntervals: string[];
    usersLimit: number | null;
    vehiclesLimit: number | null;
    activeAdsLimit: number | null;
    features: BillingPlanFeatures;
    current: boolean;
    eligible: boolean;
    blockingReasons: string[];
};

export type BillingInvoiceSummary = {
    paymentId: string;
    title: string;
    amountCents: number | null;
    currency: string;
    dueDate: string | null;
    paidAt: string | null;
    invoiceUrl: string;
    status: string;
};

export type BillingSnapshot = {
    hasSubscription: boolean;
    planId: string | null;
    planKey: string;
    planName: string;
    status: string;
    amountCents: number | null;
    currency: string;
    billingInterval: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    provider: string;
    providerCustomerId: string;
    providerSubscriptionId: string;
    pendingProrationCreditCents: number | null;
    pendingProrationCreditNote: string;
    pendingProrationCreditUpdatedAt: string | null;
    planChangeNotice: {
        active: boolean;
        title: string;
        message: string;
        currentPlanName: string;
        targetPlanName: string;
        targetBillingInterval: string;
        changeType: string;
        unlockedFeatures: string[];
        prorationAdjustmentMode: "IMMEDIATE_CHARGE" | "NEXT_CYCLE_CREDIT" | "UPCOMING_PAYMENT_UPDATE" | "NONE" | string;
        immediateChargeCents: number | null;
        creditNextCycleCents: number | null;
        remainingCreditCents: number | null;
        invoiceUrl: string;
        paymentId: string;
        requiresAction: boolean;
        createdAt: string | null;
    } | null;
    usersLimit: number | null;
    vehiclesLimit: number | null;
    activeAdsLimit: number | null;
    features: BillingPlanFeatures;
    enabledModules: string[];
    usage: BillingPlanUsage;
    availablePlans: BillingPlanOption[];
    nextInvoice: BillingInvoiceSummary | null;
    paidInvoices: BillingInvoiceSummary[];
};

export type BillingPlanChangePreview = {
    currentPlan: {
        key: string;
        name: string;
        amountCents: number | null;
        billingInterval: string;
    };
    targetPlan: {
        key: string;
        name: string;
        amountCents: number | null;
        billingInterval: string;
    };
    changeType: "UPGRADE" | "DOWNGRADE" | "CYCLE_CHANGE" | "PLAN_CHANGE";
    asaasCycle: string;
    willUpdatePendingPayments: boolean;
    requiresConfirmation: boolean;
    message: string;
    proration: {
        periodStartDate: string | null;
        periodEndDate: string | null;
        totalCycleDays: number;
        remainingDays: number;
        elapsedDays: number;
        currentPlanRemainingCents: number | null;
        targetPlanRemainingCents: number | null;
        deltaCents: number | null;
        adjustmentMode: "IMMEDIATE_CHARGE" | "NEXT_CYCLE_CREDIT" | "UPCOMING_PAYMENT_UPDATE" | "NONE";
        immediateChargeCents: number | null;
        creditNextCycleCents: number | null;
        prorationActive: boolean;
        message: string;
    };
};

export type BillingPlanChangeConfirmResponse = {
    success: boolean;
    message: string;
    subscription: {
        planKey: string;
        planName: string;
        amountCents: number | null;
        billingInterval: string;
        status: string;
    };
    adjustment: {
        mode: "IMMEDIATE_CHARGE" | "NEXT_CYCLE_CREDIT" | "UPCOMING_PAYMENT_UPDATE" | "NONE";
        immediateChargeCents: number | null;
        appliedCreditCents: number | null;
        remainingCreditCents: number | null;
        paymentId: string | null;
        invoiceUrl: string | null;
        message: string;
    } | null;
};

export type BillingAccessStatusSnapshot = {
    accessBlocked: boolean;
    companyStatus: string;
    subscriptionStatus: string;
    blockReason: string;
    paymentStatus: string;
    billingType: string;
    regularizationUrl: string;
    blockedAt: string | null;
    currentPeriodEnd: string | null;
    provider: string;
    providerCustomerId: string;
    providerSubscriptionId: string;
};

export type BillingRegularizationOptions = {
    available: boolean;
    pix: boolean;
    creditCard: boolean;
    message: string;
    regularizationUrl: string | null;
    pixCopyPasteCode: string | null;
    pixEncodedImage: string | null;
    pixExpirationDate: string | null;
    cardSummary: string | null;
    canConfirmSavedCard: boolean;
    canUpdateCard: boolean;
    canGenerateNewCharge: boolean;
};

export type DashboardResponse = {
    companyName: string;
    vehicleCount: number;
    featuredCount: number;
    publicationCount: number;
    leadCount: number;
    connectedIntegrations: number;
    inventoryValueCents: number;
    totalSalesCount: number;
    totalSalesRevenueCents: number;
    periodFilter: {
        preset: string;
        from: string;
        to: string;
    };
    leadVsSales: Array<{
        date: string;
        label: string;
        leads: number;
        sales: number;
    }>;
    salesBySeller: Array<{
        sellerId: string | null;
        sellerName: string;
        totalSales: number;
    }>;
    leadSources: Array<{ key: string; label: string; total: number }>;
    recentVehicles: Array<{
        id: string;
        title: string;
        priceCents: number | null;
        status: string;
        updatedAt: string | null;
        publicationCount: number;
    }>;
    recentConversations: Array<{
        id: string;
        contactName: string;
        lastMessage: string;
        lastAt: string | null;
        sourcePlatform: string;
    }>;
};

export type VehiclePublication = {
    id: string;
    providerKey: string;
    providerName: string;
    status: string;
    externalUrl: string | null;
};

export type VehicleFinancing = {
    downPaymentCents: number | null;
    installmentCount: number | null;
    installmentValueCents: number | null;
};

export type VehicleRecord = {
    id: string;
    stockNumber: string | null;
    title: string;
    brand: string;
    model: string;
    version: string | null;
    engine: string | null;
    year: number | null;
    modelYear: number | null;
    manufactureYear: number | null;
    priceCents: number | null;
    mileage: number | null;
    transmission: string | null;
    fuelType: string | null;
    bodyType: string | null;
    doors: number | null;
    color: string | null;
    plateFinal: string | null;
    plate: string | null;
    contactPhone: string | null;
    zipcode: string | null;
    city: string | null;
    state: string | null;
    consigned: boolean;
    consignedOwnerName: string | null;
    consignmentCommissionPercentage: number | null;
    featured: boolean;
    status: string;
    description: string | null;
    coverImageUrl: string | null;
    gallery: string[];
    optionals: string[];
    financing: VehicleFinancing;
    meliCategoryId?: string | null;
    meliListingTypeId?: string | null;
    meliCondition?: string | null;
    publications: VehiclePublication[];
    updatedAt: string | null;
};

export type OlxAdRecord = {
    id: string;
    vehicleId: string;
    localAdId: string;
    olxListId: string | null;
    olxUrl: string | null;
    importToken: string | null;
    operation: string | null;
    status: string | null;
    lastStatusMessage: string | null;
    publishedAt: string | null;
    deletedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

export type OlxVehicleMapping = {
    vehicleId: string;
    plate: string | null;
    phone: string | null;
    zipcode: string | null;
    brandId: string | null;
    modelId: string | null;
    versionId: string | null;
    fuelCode: string | null;
    gearboxCode: string | null;
    doorsCode: string | null;
    colorCode: string | null;
    featureCodes: string[];
    ad: OlxAdRecord | null;
};

export type OlxCatalogOption = {
    id: string;
    name: string;
};

export type OlxIntegrationStatus = {
    connected: boolean;
    integrationStatus: string;
    userName: string | null;
    userEmail: string | null;
    connectedAt: string | null;
    updatedAt: string | null;
    webhookConfigured: boolean;
    webhookNotificationId: string | null;
};

export type OlxCounterSnapshot = {
    performed: number | null;
    available: number | null;
    total: number | null;
};

export type OlxBalanceSnapshot = {
    available: boolean;
    id: string | null;
    name: string | null;
    ads: OlxCounterSnapshot | null;
    bumps: {
        plan: OlxCounterSnapshot | null;
        additional: OlxCounterSnapshot | null;
    } | null;
    lastRenewDate: string | null;
    nextRenewDate: string | null;
    reason: string | null;
    message: string | null;
};

export type OlxWebhookConfig = {
    id: string | null;
    configured: boolean;
    method: string | null;
    url: string | null;
    mediaType: string | null;
    type: string | null;
};

export type MeliIntegrationStatus = {
    companyId: string;
    connected: boolean;
    integrationStatus: string;
    userId: number | null;
    fullName: string | null;
    nickname: string | null;
    siteId: string | null;
    profileImageUrl: string | null;
    connectedAt: string | null;
    updatedAt: string | null;
    active: boolean;
};

export type MeliAdRecord = {
    id: string;
    vehicleId: string;
    meliItemId: string | null;
    sellerSku: string;
    categoryId: string | null;
    listingTypeId: string | null;
    title: string | null;
    permalink: string | null;
    status: string | null;
    subStatus: string | null;
    price: number | null;
    currencyId: string | null;
    publishedAt: string | null;
    pausedAt: string | null;
    closedAt: string | null;
    lastSyncedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

export type MeliVehicleAttributeValue = {
    id: string;
    valueId: string | null;
    valueName: string | null;
};

export type MeliVehicleMapping = {
    vehicleId: string;
    categoryId: string | null;
    listingTypeId: string | null;
    condition: string;
    sellerSku: string;
    title: string | null;
    description: string | null;
    priceCents: number | null;
    attributes: MeliVehicleAttributeValue[];
    ad: MeliAdRecord | null;
};

export type MeliCategoryRecord = {
    categoryId: string;
    name: string;
    parentId: string | null;
    pathFromRoot: string | null;
    settings: string | null;
    updatedAt: string | null;
};

export type MeliAllowedValue = {
    id: string;
    name: string;
};

export type MeliCategoryAttributeRecord = {
    attributeId: string;
    name: string;
    valueType: string;
    required: boolean;
    catalogRequired: boolean;
    allowedValues: MeliAllowedValue[];
    raw: string;
};

export type MeliCategorySuggestion = {
    domainId: string | null;
    domainName: string | null;
    categoryId: string;
    categoryName: string;
};

export type MeliListingTypeRecord = {
    id: string;
    name: string;
    siteId: string;
    remainingListings: number | null;
};

export type MeliListingPriceRecord = {
    listingTypeId: string;
    saleFeeAmount: number | null;
    listingFeeAmount: number | null;
    currencyId: string;
};

export type MeliSyncSummary = {
    total: number;
    syncedAt: string;
};

export type IntegrationRecord = {
    providerKey: string;
    displayName: string;
    status: string;
    endpointUrl: string | null;
    accountName: string | null;
    username: string | null;
    hasApiToken: boolean;
    hasWebhookSecret: boolean;
    supportsPublication: boolean;
    lastSyncAt: string | null;
    lastError: string | null;
    settings: Record<string, string>;
};

export type WebmotorsFeatureFlags = {
    soapAdsEnabled: boolean;
    restLeadsEnabled: boolean;
    catalogSyncEnabled: boolean;
    leadPullEnabled: boolean;
    callbackEnabled: boolean;
};

export type WebmotorsSettingsRecord = {
    id: string;
    companyId: string;
    storeKey: string;
    storeName: string;
    featureFlags: WebmotorsFeatureFlags;
    soapBaseUrl: string;
    soapAuthPath: string;
    soapInventoryPath: string;
    soapCatalogPath: string;
    soapCnpj: string;
    soapEmail: string;
    soapPassword: string;
    restTokenUrl: string;
    restApiBaseUrl: string;
    restUsername: string;
    restPassword: string;
    restClientId: string;
    restClientSecret: string;
    callbackSecret: string;
};

export type WebmotorsValidationResult = {
    success: boolean;
    statusCode: number;
    expiresInSeconds: number;
    message: string;
};

export type PublicationRecord = {
    id: string;
    vehicleId: string;
    vehicleTitle: string;
    providerKey: string;
    providerName: string;
    status: string;
    externalUrl: string | null;
    lastError: string | null;
    publishedAt: string | null;
    updatedAt: string | null;
};

export type ConversationRecord = {
    id: string;
    phone: string;
    displayName: string | null;
    photoUrl: string | null;
    sourcePlatform: string | null;
    sourceReference: string | null;
    status: "NEW" | "IN_PROGRESS";
    assignedTeamId: string | null;
    assignedTeamName: string | null;
    assignedUserId: string | null;
    assignedUserName: string | null;
    lastMessage: string | null;
    lastAt: string | null;
    lastMessageFromMe: boolean | null;
    lastMessageStatus: string | null;
    lastMessageType: string | null;
    sessionId?: string | null;
    arrivedAt?: string | null;
    firstResponseAt?: string | null;
    completedAt?: string | null;
    classificationResult?: string | null;
    classificationLabel?: string | null;
    saleCompleted?: boolean | null;
    soldVehicleId?: string | null;
    soldVehicleTitle?: string | null;
    saleCompletedAt?: string | null;
    latestCompletedAt?: string | null;
    latestCompletedClassificationResult?: string | null;
    latestCompletedClassificationLabel?: string | null;
    latestCompletedSaleCompleted?: boolean | null;
    latestCompletedSoldVehicleId?: string | null;
    latestCompletedSoldVehicleTitle?: string | null;
    labels?: Array<{
        id: string;
        title: string;
        color?: string | null;
    }> | null;
};

export type ConversationMessage = {
    id: string;
    conversationId: string;
    phone: string;
    text: string | null;
    type: string | null;
    imageUrl?: string | null;
    stickerUrl?: string | null;
    videoUrl?: string | null;
    audioUrl?: string | null;
    documentUrl?: string | null;
    documentName?: string | null;
    fromMe: boolean;
    status?: string | null;
    createdAt: string;
};

export type SignupStatus = {
    intentId: string;
    status: string;
    message: string;
    accessReady: boolean;
    loginEmail: string;
    companyName: string;
};

export type PublicInventoryCompany = {
    id: string;
    name: string;
    publicSlug: string;
    profileImageUrl: string | null;
    whatsappNumber: string | null;
};

export type PublicCatalogBannerMode = "VEHICLES" | "CUSTOM_IMAGES";

export type PublicInventoryBanner = {
    id: string;
    kind: "VEHICLE" | "CUSTOM_IMAGE";
    vehicleId: string | null;
    title: string;
    subtitle: string;
    imageUrl: string | null;
    priceCents: number | null;
    city: string | null;
    state: string | null;
    modelYear: number | null;
    featured: boolean;
};

export type PublicInventoryVehicle = {
    id: string;
    stockNumber: string | null;
    title: string;
    brand: string;
    model: string;
    version: string | null;
    engine: string | null;
    year: number | null;
    modelYear: number | null;
    manufactureYear: number | null;
    priceCents: number | null;
    mileage: number | null;
    transmission: string | null;
    fuelType: string | null;
    bodyType: string | null;
    doors: number | null;
    color: string | null;
    plateFinal: string | null;
    city: string | null;
    state: string | null;
    featured: boolean;
    status: string;
    description: string | null;
    coverImageUrl: string | null;
    gallery: string[];
    optionals: string[];
    financing: VehicleFinancing;
    updatedAt: string | null;
};

export type PublicInventoryCatalog = {
    company: PublicInventoryCompany;
    banners: PublicInventoryBanner[];
    vehicles: PublicInventoryVehicle[];
};

export type PublicCatalogSettings = {
    bannerMode: PublicCatalogBannerMode;
    customImageUrls: string[];
};

export type PublicVehicleDetail = {
    company: PublicInventoryCompany;
    vehicle: PublicInventoryVehicle;
};

export type PublicLeadEventSummary = {
    totalTrackedInteractions: number;
    totalContactClicks: number;
    totalInterestClicks: number;
    sources: Array<{
        sourceType: string;
        sourceReference: string;
        totalInteractions: number;
        stockInteractions: number;
        vehicleInteractions: number;
        contactClicks: number;
        interestClicks: number;
        lastEventAt: string | null;
    }>;
    recentEvents: Array<{
        eventType: string;
        sourceType: string;
        sourceReference: string | null;
        vehicleId: string | null;
        pagePath: string | null;
        createdAt: string | null;
    }>;
};

export type PublicCatalogLeadList = {
    preset: string;
    fromDate: string;
    toDate: string;
    canViewAllLeads: boolean;
    totalLeads: number;
    leadsWithVehicle: number;
    leadsWithCampaign: number;
    uniquePhones: number;
    leads: Array<{
        id: string;
        customerName: string;
        customerPhone: string;
        vehicleId: string | null;
        vehicleTitle: string | null;
        vehiclePriceCents: number | null;
        publicVehiclePath: string | null;
        sourceType: string | null;
        sourceReference: string | null;
        pagePath: string | null;
        sourceUrl: string | null;
        sellerUserId: string | null;
        convertedToSale: boolean;
        convertedSaleId: string | null;
        createdAt: string | null;
    }>;
};

export type PublicLinkRecord = {
    id: string;
    name: string;
    linkKind: string;
    scopeType: string;
    sourceType: string | null;
    sourceReference: string | null;
    useCompanyWhatsapp: boolean;
    whatsappNumber: string | null;
    responsibleUserId: string | null;
    responsibleUserName: string | null;
    vehicleId: string | null;
    vehicleTitle: string | null;
    publicPath: string;
    totalInteractions: number;
    contactClicks: number;
    interestClicks: number;
    lastInteractionAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};
