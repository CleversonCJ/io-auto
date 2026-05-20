package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoClassificationResult;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoConversationRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoConversationEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoSessionEntity;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoPublicCatalogLeadRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehiclePublicationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoPublicCatalogLeadEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehiclePublicationEntity;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsAdRepositoryJpa;
import com.io.appioweb.adapters.web.atendimentos.AtendimentoSessionLifecycleService;
import com.io.appioweb.application.auth.port.out.TeamRepositoryPort;
import com.io.appioweb.application.auth.port.out.UserRepositoryPort;
import com.io.appioweb.application.ioauto.meli.MeliAdService;
import com.io.appioweb.application.ioauto.olx.OlxAdService;
import com.io.appioweb.application.ioauto.webmotors.WebmotorsAdsService;
import com.io.appioweb.domain.auth.entity.Team;
import com.io.appioweb.domain.auth.entity.User;
import com.io.appioweb.shared.errors.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class IoAutoSalesService {

    private static final Logger log = LoggerFactory.getLogger(IoAutoSalesService.class);

    private final IoAutoVehicleRepositoryJpa vehicles;
    private final IoAutoVehiclePublicationRepositoryJpa publications;
    private final AtendimentoSessionRepositoryJpa sessions;
    private final WebmotorsAdRepositoryJpa webmotorsAds;
    private final WebmotorsAdsService webmotorsAdsService;
    private final AtendimentoConversationRepositoryJpa conversations;
    private final IoAutoPublicCatalogLeadRepositoryJpa publicCatalogLeads;
    private final AtendimentoSessionLifecycleService sessionLifecycleService;
    private final UserRepositoryPort users;
    private final TeamRepositoryPort teams;
    private final OlxAdService olxAdService;
    private final MeliAdService meliAdService;

    public IoAutoSalesService(
            IoAutoVehicleRepositoryJpa vehicles,
            IoAutoVehiclePublicationRepositoryJpa publications,
            AtendimentoSessionRepositoryJpa sessions,
            WebmotorsAdRepositoryJpa webmotorsAds,
            WebmotorsAdsService webmotorsAdsService,
            AtendimentoConversationRepositoryJpa conversations,
            IoAutoPublicCatalogLeadRepositoryJpa publicCatalogLeads,
            AtendimentoSessionLifecycleService sessionLifecycleService,
            UserRepositoryPort users,
            TeamRepositoryPort teams,
            OlxAdService olxAdService,
            MeliAdService meliAdService
    ) {
        this.vehicles = vehicles;
        this.publications = publications;
        this.sessions = sessions;
        this.webmotorsAds = webmotorsAds;
        this.webmotorsAdsService = webmotorsAdsService;
        this.conversations = conversations;
        this.publicCatalogLeads = publicCatalogLeads;
        this.sessionLifecycleService = sessionLifecycleService;
        this.users = users;
        this.teams = teams;
        this.olxAdService = olxAdService;
        this.meliAdService = meliAdService;
    }

    @Transactional
    public SaleVehicleSnapshot registerCompletedSale(
            UUID companyId,
            JpaAtendimentoSessionEntity session,
            UUID soldVehicleId,
            Instant soldAt,
            String saleOriginPlatform
    ) {
        return registerCompletedSale(companyId, session, soldVehicleId, soldAt, saleOriginPlatform, null, null, null, null);
    }

    @Transactional
    public SaleVehicleSnapshot registerCompletedSale(
            UUID companyId,
            JpaAtendimentoSessionEntity session,
            UUID soldVehicleId,
            Instant soldAt,
            String saleOriginPlatform,
            UUID sellerUserId,
            String sellerUserName,
            UUID sellerTeamId,
            String sellerTeamName
    ) {
        JpaIoAutoVehicleEntity vehicle = vehicles.findByIdAndCompanyId(soldVehicleId, companyId)
                .orElseThrow(() -> new BusinessException("IOAUTO_SOLD_VEHICLE_NOT_FOUND", "Veículo não encontrado para concluir a venda."));

        vehicle.setStatus("SOLD");
        vehicle.setUpdatedAt(soldAt);
        vehicles.saveAndFlush(vehicle);

        List<JpaIoAutoVehiclePublicationEntity> vehiclePublications = publications.findAllByCompanyIdAndVehicleId(companyId, soldVehicleId);
        for (JpaIoAutoVehiclePublicationEntity publication : vehiclePublications) {
            publication.setStatus("SOLD");
            publication.setLastError(null);
            publication.setSyncedAt(soldAt);
            publication.setUpdatedAt(soldAt);
        }
        if (!vehiclePublications.isEmpty()) {
            publications.saveAllAndFlush(vehiclePublications);
        }

        if (sellerUserId != null) {
            session.setResponsibleUserId(sellerUserId);
            session.setResponsibleUserName(safeTrim(sellerUserName));
        }
        if (sellerTeamId != null) {
            session.setResponsibleTeamId(sellerTeamId);
            session.setResponsibleTeamName(safeTrim(sellerTeamName));
        }
        session.setSaleCompleted(true);
        session.setSoldVehicleId(vehicle.getId());
        session.setSoldVehicleTitle(vehicle.getTitle());
        session.setSaleCompletedAt(soldAt);
        session.setSaleOriginPlatform(normalizeSaleOriginPlatform(saleOriginPlatform));
        session.setUpdatedAt(soldAt);
        sessions.saveAndFlush(session);

        deactivateIntegratedAds(companyId, soldVehicleId, vehiclePublications);

        return new SaleVehicleSnapshot(vehicle.getId(), vehicle.getTitle(), normalizeStatus(vehicle.getStatus()));
    }

    @Transactional
    public SaleVehicleSnapshot registerPublicCatalogLeadSale(
            UUID companyId,
            UUID leadId,
            UUID sellerUserId,
            Instant soldAt
    ) {
        JpaIoAutoPublicCatalogLeadEntity lead = publicCatalogLeads.findByIdAndCompanyId(leadId, companyId)
                .orElseThrow(() -> new BusinessException("IOAUTO_PUBLIC_CATALOG_LEAD_NOT_FOUND", "Lead do catálogo não encontrado."));

        if (lead.getVehicleId() == null) {
            throw new BusinessException("IOAUTO_PUBLIC_CATALOG_LEAD_VEHICLE_REQUIRED", "Este lead não possui um veículo de interesse vinculado para fechar a venda.");
        }
        if (lead.isConvertedToSale()) {
            throw new BusinessException("IOAUTO_PUBLIC_CATALOG_LEAD_ALREADY_CONVERTED", "Esta venda já foi concluída para este lead.");
        }

        ResolvedSeller seller = resolveSeller(companyId, sellerUserId);
        JpaAtendimentoConversationEntity conversation = resolveCatalogConversation(companyId, lead, seller, soldAt);
        JpaAtendimentoSessionEntity session = sessionLifecycleService.ensureSessionForHumanAction(
                companyId,
                conversation,
                soldAt,
                seller.teamId(),
                seller.teamName(),
                seller.user().id(),
                seller.user().fullName(),
                true
        );
        session = sessionLifecycleService.concludeConversation(
                companyId,
                conversation,
                AtendimentoClassificationResult.OBJECTIVE_ACHIEVED,
                "Venda concluída",
                List.of(),
                soldAt
        );

        SaleVehicleSnapshot snapshot = registerCompletedSale(
                companyId,
                session,
                lead.getVehicleId(),
                soldAt,
                "CATALOG",
                seller.user().id(),
                seller.user().fullName(),
                seller.teamId(),
                seller.teamName()
        );

        lead.setSellerUserId(seller.user().id());
        lead.setConvertedToSale(true);
        lead.setConvertedSaleId(session.getId());
        publicCatalogLeads.saveAndFlush(lead);

        return snapshot;
    }

    @Transactional
    public SaleVehicleSnapshot registerInventoryVehicleSale(
            UUID companyId,
            UUID vehicleId,
            UUID sellerUserId,
            UUID buyerConversationId,
            String buyerName,
            String buyerPhone,
            boolean requireBuyerLead,
            Instant soldAt
    ) {
        JpaIoAutoVehicleEntity vehicle = vehicles.findByIdAndCompanyId(vehicleId, companyId)
                .orElseThrow(() -> new BusinessException("IOAUTO_SOLD_VEHICLE_NOT_FOUND", "Veículo não encontrado para concluir a venda."));

        boolean alreadyRegistered = sessions.findAllByCompanyIdAndSaleCompletedIsTrueOrderBySaleCompletedAtDesc(companyId).stream()
                .anyMatch(session -> vehicleId.equals(session.getSoldVehicleId()));
        if (alreadyRegistered) {
            throw new BusinessException("IOAUTO_VEHICLE_SALE_ALREADY_REGISTERED", "Este veículo já possui uma venda concluída registrada.");
        }

        ResolvedSeller seller = resolveSeller(companyId, sellerUserId);
        JpaAtendimentoConversationEntity conversation = resolveInventorySaleConversation(
                companyId,
                vehicle,
                seller,
                buyerConversationId,
                buyerName,
                buyerPhone,
                requireBuyerLead,
                soldAt
        );
        JpaAtendimentoSessionEntity session = sessionLifecycleService.ensureSessionForHumanAction(
                companyId,
                conversation,
                soldAt,
                seller.teamId(),
                seller.teamName(),
                seller.user().id(),
                seller.user().fullName(),
                true
        );
        session = sessionLifecycleService.concludeConversation(
                companyId,
                conversation,
                AtendimentoClassificationResult.OBJECTIVE_ACHIEVED,
                "Venda concluída pelo estoque",
                List.of(),
                soldAt
        );

        return registerCompletedSale(
                companyId,
                session,
                vehicleId,
                soldAt,
                "MANUAL",
                seller.user().id(),
                seller.user().fullName(),
                seller.teamId(),
                seller.teamName()
        );
    }

    private JpaAtendimentoConversationEntity resolveInventorySaleConversation(
            UUID companyId,
            JpaIoAutoVehicleEntity vehicle,
            ResolvedSeller seller,
            UUID buyerConversationId,
            String buyerName,
            String buyerPhone,
            boolean requireBuyerLead,
            Instant referenceAt
    ) {
        if (buyerConversationId != null) {
            JpaAtendimentoConversationEntity conversation = conversations.findByIdAndCompanyId(buyerConversationId, companyId)
                    .orElseThrow(() -> new BusinessException("IOAUTO_SALE_BUYER_LEAD_NOT_FOUND", "Lead selecionado não encontrado para vincular a venda."));
            if ("SYSTEM_SALE".equalsIgnoreCase(safeTrim(conversation.getSourcePlatform()))) {
                throw new BusinessException("IOAUTO_SALE_BUYER_LEAD_INVALID", "Selecione um lead válido para vincular a venda.");
            }
            return prepareBuyerConversation(conversation, seller, vehicle, referenceAt);
        }

        String normalizedBuyerName = safeTrim(buyerName);
        String normalizedBuyerPhone = normalizePhone(buyerPhone);
        if (normalizedBuyerName != null || !normalizedBuyerPhone.isBlank()) {
            if (normalizedBuyerName == null) {
                throw new BusinessException("IOAUTO_SALE_BUYER_NAME_REQUIRED", "Informe o nome do comprador para criar o lead.");
            }
            if (normalizedBuyerPhone.isBlank()) {
                throw new BusinessException("IOAUTO_SALE_BUYER_PHONE_REQUIRED", "Informe o telefone do comprador para criar o lead.");
            }

            JpaAtendimentoConversationEntity conversation = conversations.findByCompanyIdAndPhone(companyId, normalizedBuyerPhone)
                    .orElseGet(() -> createInventoryBuyerConversation(companyId, vehicle, normalizedBuyerName, normalizedBuyerPhone, referenceAt));
            if (safeTrim(conversation.getDisplayName()) == null) {
                conversation.setDisplayName(normalizedBuyerName);
            }
            return prepareBuyerConversation(conversation, seller, vehicle, referenceAt);
        }

        if (requireBuyerLead) {
            throw new BusinessException("IOAUTO_SALE_BUYER_LEAD_REQUIRED", "Selecione um lead existente ou crie o comprador para concluir a venda.");
        }

        return createSystemSaleConversation(companyId, vehicle, seller, referenceAt);
    }

    private JpaAtendimentoConversationEntity resolveCatalogConversation(
            UUID companyId,
            JpaIoAutoPublicCatalogLeadEntity lead,
            ResolvedSeller seller,
            Instant referenceAt
    ) {
        String normalizedPhone = normalizePhone(lead.getCustomerPhone());
        if (normalizedPhone.isBlank()) {
            throw new BusinessException("IOAUTO_PUBLIC_CATALOG_LEAD_PHONE_INVALID", "O lead precisa ter um telefone válido para fechar a venda.");
        }

        JpaAtendimentoConversationEntity conversation = conversations.findByCompanyIdAndPhone(companyId, normalizedPhone)
                .orElseGet(() -> createCatalogConversation(companyId, lead, normalizedPhone, referenceAt));

        conversation.setDisplayName(firstNonBlank(conversation.getDisplayName(), safeTrim(lead.getCustomerName()), normalizedPhone));
        if (safeTrim(conversation.getSourcePlatform()) == null) {
            conversation.setSourcePlatform("PUBLIC_CATALOG");
        }
        if (safeTrim(conversation.getSourceReference()) == null) {
            conversation.setSourceReference(firstNonBlank(safeTrim(lead.getSourceReference()), "catalog-lead-" + lead.getId()));
        }
        conversation.setAssignedTeamId(seller.teamId());
        conversation.setAssignedUserId(seller.user().id());
        conversation.setAssignedUserName(seller.user().fullName());
        conversation.setStatus("IN_PROGRESS");
        conversation.setStartedAt(conversation.getStartedAt() == null ? referenceAt : conversation.getStartedAt());
        conversation.setLastMessageText(firstNonBlank(conversation.getLastMessageText(), buildCatalogLeadSummary(lead)));
        conversation.setLastMessageAt(conversation.getLastMessageAt() == null ? referenceAt : conversation.getLastMessageAt());
        conversation.setUpdatedAt(referenceAt);
        return conversations.saveAndFlush(conversation);
    }

    private JpaAtendimentoConversationEntity createCatalogConversation(
            UUID companyId,
            JpaIoAutoPublicCatalogLeadEntity lead,
            String normalizedPhone,
            Instant referenceAt
    ) {
        JpaAtendimentoConversationEntity entity = new JpaAtendimentoConversationEntity();
        entity.setId(UUID.randomUUID());
        entity.setCompanyId(companyId);
        entity.setPhone(normalizedPhone);
        entity.setDisplayName(firstNonBlank(safeTrim(lead.getCustomerName()), normalizedPhone));
        entity.setSourcePlatform("PUBLIC_CATALOG");
        entity.setSourceReference(firstNonBlank(safeTrim(lead.getSourceReference()), "catalog-lead-" + lead.getId()));
        entity.setLastMessageText(buildCatalogLeadSummary(lead));
        entity.setLastMessageAt(firstNonNull(lead.getCreatedAt(), referenceAt));
        entity.setStatus("NEW");
        entity.setHumanHandoffRequested(false);
        entity.setHumanHandoffQueue(null);
        entity.setHumanHandoffRequestedAt(null);
        entity.setHumanUserChoiceRequired(false);
        entity.setHumanChoiceOptionsJson("[]");
        entity.setCreatedAt(firstNonNull(lead.getCreatedAt(), referenceAt));
        entity.setUpdatedAt(referenceAt);
        return entity;
    }

    private JpaAtendimentoConversationEntity createSystemSaleConversation(
            UUID companyId,
            JpaIoAutoVehicleEntity vehicle,
            ResolvedSeller seller,
            Instant referenceAt
    ) {
        JpaAtendimentoConversationEntity entity = new JpaAtendimentoConversationEntity();
        entity.setId(UUID.randomUUID());
        entity.setCompanyId(companyId);
        entity.setPhone(buildSystemSalePhone(vehicle.getId()));
        entity.setDisplayName("Venda de estoque");
        entity.setSourcePlatform("SYSTEM_SALE");
        entity.setSourceReference(vehicle.getId().toString());
        entity.setLastMessageText("Venda concluída pelo estoque para o veículo " + firstNonBlank(safeTrim(vehicle.getTitle()), "sem identificação") + ".");
        entity.setLastMessageAt(referenceAt);
        entity.setStatus("IN_PROGRESS");
        entity.setAssignedTeamId(seller.teamId());
        entity.setAssignedUserId(seller.user().id());
        entity.setAssignedUserName(seller.user().fullName());
        entity.setHumanHandoffRequested(false);
        entity.setHumanHandoffQueue(null);
        entity.setHumanHandoffRequestedAt(null);
        entity.setHumanUserChoiceRequired(false);
        entity.setHumanChoiceOptionsJson("[]");
        entity.setStartedAt(referenceAt);
        entity.setCreatedAt(referenceAt);
        entity.setUpdatedAt(referenceAt);
        return conversations.saveAndFlush(entity);
    }

    private JpaAtendimentoConversationEntity createInventoryBuyerConversation(
            UUID companyId,
            JpaIoAutoVehicleEntity vehicle,
            String buyerName,
            String buyerPhone,
            Instant referenceAt
    ) {
        JpaAtendimentoConversationEntity entity = new JpaAtendimentoConversationEntity();
        entity.setId(UUID.randomUUID());
        entity.setCompanyId(companyId);
        entity.setPhone(buyerPhone);
        entity.setDisplayName(firstNonBlank(buyerName, buyerPhone));
        entity.setSourcePlatform("MANUAL");
        entity.setSourceReference("inventory-sale-" + vehicle.getId());
        entity.setLastMessageText(buildInventorySaleSummary(vehicle));
        entity.setLastMessageAt(referenceAt);
        entity.setStatus("NEW");
        entity.setHumanHandoffRequested(false);
        entity.setHumanHandoffQueue(null);
        entity.setHumanHandoffRequestedAt(null);
        entity.setHumanUserChoiceRequired(false);
        entity.setHumanChoiceOptionsJson("[]");
        entity.setCreatedAt(referenceAt);
        entity.setUpdatedAt(referenceAt);
        return conversations.saveAndFlush(entity);
    }

    private JpaAtendimentoConversationEntity prepareBuyerConversation(
            JpaAtendimentoConversationEntity conversation,
            ResolvedSeller seller,
            JpaIoAutoVehicleEntity vehicle,
            Instant referenceAt
    ) {
        conversation.setAssignedTeamId(seller.teamId());
        conversation.setAssignedUserId(seller.user().id());
        conversation.setAssignedUserName(seller.user().fullName());
        conversation.setStatus("IN_PROGRESS");
        conversation.setStartedAt(conversation.getStartedAt() == null ? referenceAt : conversation.getStartedAt());
        conversation.setLastMessageText(firstNonBlank(conversation.getLastMessageText(), buildInventorySaleSummary(vehicle)));
        conversation.setLastMessageAt(conversation.getLastMessageAt() == null ? referenceAt : conversation.getLastMessageAt());
        conversation.setUpdatedAt(referenceAt);
        if (safeTrim(conversation.getSourcePlatform()) == null) {
            conversation.setSourcePlatform("MANUAL");
        }
        if (safeTrim(conversation.getSourceReference()) == null) {
            conversation.setSourceReference("inventory-sale-" + vehicle.getId());
        }
        return conversations.saveAndFlush(conversation);
    }

    private void deactivateIntegratedAds(UUID companyId, UUID soldVehicleId, List<JpaIoAutoVehiclePublicationEntity> vehiclePublications) {
        boolean hasWebmotors = false;
        boolean hasOlx = false;
        boolean hasMeli = false;

        for (JpaIoAutoVehiclePublicationEntity publication : vehiclePublications) {
            String providerKey = normalizeProvider(publication.getProviderKey());
            if ("WEBMOTORS".equals(providerKey)) {
                hasWebmotors = true;
            } else if ("OLX".equals(providerKey) || "OLX_AUTOS".equals(providerKey)) {
                hasOlx = true;
            } else if ("MERCADO_LIVRE".equals(providerKey) || "MERCADOLIVRE".equals(providerKey) || "MELI".equals(providerKey)) {
                hasMeli = true;
            }
        }

        if (hasWebmotors && webmotorsAds.findByCompanyIdAndVehicleId(companyId, soldVehicleId).isPresent()) {
            webmotorsAdsService.enqueueDelete(companyId, soldVehicleId, "default");
        }

        if (hasOlx) {
            try {
                olxAdService.unpublishVehicle(companyId, soldVehicleId);
            } catch (Exception exception) {
                log.warn("Falha ao despublicar veículo {} na OLX para a empresa {}.", soldVehicleId, companyId, exception);
            }
        }

        if (hasMeli) {
            try {
                meliAdService.closeAd(companyId, soldVehicleId);
            } catch (Exception exception) {
                log.warn("Falha ao encerrar veículo {} no Mercado Livre para a empresa {}.", soldVehicleId, companyId, exception);
            }
        }
    }

    private ResolvedSeller resolveSeller(UUID companyId, UUID sellerUserId) {
        if (sellerUserId == null) {
            throw new BusinessException("IOAUTO_SALE_SELLER_REQUIRED", "Selecione o vendedor responsável para concluir a venda.");
        }

        User user = users.findByIdAndCompanyId(sellerUserId, companyId)
                .filter(User::isActive)
                .orElseThrow(() -> new BusinessException("IOAUTO_SALE_SELLER_NOT_FOUND", "Vendedor não encontrado para concluir a venda."));
        Team team = user.teamId() == null ? null : teams.findByIdAndCompanyId(user.teamId(), companyId).orElse(null);
        return new ResolvedSeller(user, team == null ? null : team.id(), team == null ? null : team.name());
    }

    private String buildCatalogLeadSummary(JpaIoAutoPublicCatalogLeadEntity lead) {
        String vehicleName = firstNonBlank(safeTrim(lead.getVehicleInterestName()), "veículo do catálogo");
        return "Lead do catálogo público com interesse em " + vehicleName + ".";
    }

    private String buildInventorySaleSummary(JpaIoAutoVehicleEntity vehicle) {
        return "Venda concluída pelo estoque para o veículo " + firstNonBlank(safeTrim(vehicle.getTitle()), "sem identificação") + ".";
    }

    private String normalizeStatus(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        return normalized.isBlank() ? "SOLD" : normalized;
    }

    private String normalizeSaleOriginPlatform(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) return "MANUAL";
        return normalized;
    }

    private String normalizeProvider(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
    }

    private String normalizePhone(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private String buildSystemSalePhone(UUID vehicleId) {
        String compact = vehicleId == null ? UUID.randomUUID().toString().replace("-", "") : vehicleId.toString().replace("-", "");
        return ("SALE-" + compact).substring(0, Math.min(30, "SALE-".length() + compact.length()));
    }

    private static Instant firstNonNull(Instant left, Instant right) {
        return left != null ? left : right;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = safeTrim(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private static String safeTrim(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record SaleVehicleSnapshot(UUID vehicleId, String vehicleTitle, String vehicleStatus) {
    }

    private record ResolvedSeller(User user, UUID teamId, String teamName) {
    }
}
