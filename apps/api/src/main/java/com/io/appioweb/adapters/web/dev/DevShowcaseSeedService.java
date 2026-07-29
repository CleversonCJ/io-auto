package com.io.appioweb.adapters.web.dev;

import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoClassificationResult;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoConversationRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoMessageRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionStatus;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoConversationEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoMessageEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoSessionEntity;
import com.io.appioweb.adapters.persistence.auth.CompanyRepositoryJpa;
import com.io.appioweb.adapters.persistence.auth.JpaCompanyEntity;
import com.io.appioweb.adapters.persistence.auth.JpaTeamEntity;
import com.io.appioweb.adapters.persistence.auth.JpaUserEntity;
import com.io.appioweb.adapters.persistence.auth.TeamRepositoryJpa;
import com.io.appioweb.adapters.persistence.auth.UserRepositoryJpa;
import com.io.appioweb.adapters.persistence.crm.CrmCompanyStateRepositoryJpa;
import com.io.appioweb.adapters.persistence.crm.JpaCrmCompanyStateEntity;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoBillingSubscriptionRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoIntegrationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehiclePublicationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoBillingSubscriptionEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoIntegrationEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehiclePublicationEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@Profile("local")
public class DevShowcaseSeedService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final UUID DEFAULT_DEMO_COMPANY_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String DEFAULT_PASSWORD_HASH = "$2a$10$WJuStJ2axeWO8ukE305FXezO7Yd88MuAVr4ahmmkG3EM7KkOsIJby";

    private final CompanyRepositoryJpa companies;
    private final TeamRepositoryJpa teams;
    private final UserRepositoryJpa users;
    private final CrmCompanyStateRepositoryJpa crmState;
    private final AtendimentoConversationRepositoryJpa conversations;
    private final AtendimentoMessageRepositoryJpa messages;
    private final AtendimentoSessionRepositoryJpa sessions;
    private final IoAutoVehicleRepositoryJpa vehicles;
    private final IoAutoVehiclePublicationRepositoryJpa publications;
    private final IoAutoIntegrationRepositoryJpa integrations;
    private final IoAutoBillingSubscriptionRepositoryJpa subscriptions;

    public DevShowcaseSeedService(
            CompanyRepositoryJpa companies,
            TeamRepositoryJpa teams,
            UserRepositoryJpa users,
            CrmCompanyStateRepositoryJpa crmState,
            AtendimentoConversationRepositoryJpa conversations,
            AtendimentoMessageRepositoryJpa messages,
            AtendimentoSessionRepositoryJpa sessions,
            IoAutoVehicleRepositoryJpa vehicles,
            IoAutoVehiclePublicationRepositoryJpa publications,
            IoAutoIntegrationRepositoryJpa integrations,
            IoAutoBillingSubscriptionRepositoryJpa subscriptions
    ) {
        this.companies = companies;
        this.teams = teams;
        this.users = users;
        this.crmState = crmState;
        this.conversations = conversations;
        this.messages = messages;
        this.sessions = sessions;
        this.vehicles = vehicles;
        this.publications = publications;
        this.integrations = integrations;
        this.subscriptions = subscriptions;
    }

    @Transactional
    public ShowcaseSeedResult seedShowcase(String companyIdRaw, String emailRaw) {
        JpaCompanyEntity company = resolveCompany(companyIdRaw, emailRaw);
        UUID companyId = company.getId();
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);

        JpaTeamEntity salesTeam = ensureTeam(companyId, "Equipe Comercial");
        JpaUserEntity mariana = ensureUser(companyId, salesTeam.getId(), "mariana.costa@ioauto.demo", "Mariana Costa", "Closer");
        JpaUserEntity lucas = ensureUser(companyId, salesTeam.getId(), "lucas.ferreira@ioauto.demo", "Lucas Ferreira", "Consultor");
        JpaUserEntity rafael = ensureUser(companyId, salesTeam.getId(), "rafael.nogueira@ioauto.demo", "Rafael Nogueira", "Consultor");

        Map<String, JpaUserEntity> sellersByKey = Map.of(
                "mariana", mariana,
                "lucas", lucas,
                "rafael", rafael
        );

        seedIntegrations(companyId, now);
        Map<String, JpaIoAutoVehicleEntity> vehiclesByCode = seedVehicles(companyId, now);
        int publicationCount = seedPublications(companyId, vehiclesByCode, now);
        int conversationCount = seedConversations(companyId, salesTeam, sellersByKey, vehiclesByCode, now);
        seedBilling(companyId, now);
        seedCrm(companyId, now);

        return new ShowcaseSeedResult(
                companyId,
                company.getName(),
                vehiclesByCode.size(),
                publicationCount,
                conversationCount,
                List.of(mariana.getEmail(), lucas.getEmail(), rafael.getEmail())
        );
    }

    private JpaCompanyEntity resolveCompany(String companyIdRaw, String emailRaw) {
        String trimmedCompanyId = normalize(companyIdRaw);
        if (!trimmedCompanyId.isBlank()) {
            try {
                return companies.findById(UUID.fromString(trimmedCompanyId))
                        .orElseThrow(() -> new BusinessException("DEV_SHOWCASE_COMPANY_NOT_FOUND", "Empresa nao encontrada para gerar os dados ficticios."));
            } catch (IllegalArgumentException exception) {
                throw new BusinessException("DEV_SHOWCASE_INVALID_COMPANY_ID", "O companyId informado nao e um UUID valido.");
            }
        }

        String trimmedEmail = normalize(emailRaw).toLowerCase(Locale.ROOT);
        if (!trimmedEmail.isBlank()) {
            return users.findAllByEmail(trimmedEmail).stream()
                    .findFirst()
                    .flatMap(user -> companies.findById(user.getCompanyId()))
                    .orElseThrow(() -> new BusinessException("DEV_SHOWCASE_EMAIL_NOT_FOUND", "Nao foi encontrada nenhuma empresa para o email informado."));
        }

        Optional<JpaCompanyEntity> defaultCompany = companies.findById(DEFAULT_DEMO_COMPANY_ID);
        if (defaultCompany.isPresent()) return defaultCompany.get();

        List<JpaCompanyEntity> allCompanies = companies.findAll();
        if (allCompanies.size() == 1) return allCompanies.get(0);

        throw new BusinessException(
                "DEV_SHOWCASE_COMPANY_REQUIRED",
                "Informe companyId ou email para definir qual tenant deve receber os dados de demonstracao."
        );
    }

    private JpaTeamEntity ensureTeam(UUID companyId, String name) {
        return teams.findAllByCompanyIdOrderByNameAsc(companyId).stream()
                .filter(team -> name.equalsIgnoreCase(team.getName()))
                .findFirst()
                .orElseGet(() -> {
                    Instant now = Instant.now();
                    JpaTeamEntity entity = new JpaTeamEntity();
                    entity.setId(uuidFor(companyId, "team:" + name.toLowerCase(Locale.ROOT)));
                    entity.setCompanyId(companyId);
                    entity.setName(name);
                    entity.setCreatedAt(now);
                    entity.setUpdatedAt(now);
                    return teams.save(entity);
                });
    }

    private JpaUserEntity ensureUser(UUID companyId, UUID teamId, String email, String fullName, String jobTitle) {
        JpaUserEntity entity = users.findByCompanyIdAndEmail(companyId, email)
                .orElseGet(JpaUserEntity::new);
        if (entity.getId() == null) {
            entity.setId(uuidFor(companyId, "user:" + email.toLowerCase(Locale.ROOT)));
            entity.setCompanyId(companyId);
            entity.setCreatedAt(Instant.now());
        }
        entity.setEmail(email.toLowerCase(Locale.ROOT));
        entity.setFullName(fullName);
        entity.setPasswordHash(normalize(entity.getPasswordHash()).isBlank() ? DEFAULT_PASSWORD_HASH : entity.getPasswordHash());
        entity.setJobTitle(jobTitle);
        entity.setPermissionPreset(normalize(entity.getPermissionPreset()).isBlank() ? "admin" : entity.getPermissionPreset());
        entity.setModulePermissions(null);
        entity.setTeamId(teamId);
        entity.setProfileImageUrl("https://i.pravatar.cc/200?u=" + email);
        entity.setActive(true);
        return users.save(entity);
    }

    private void seedIntegrations(UUID companyId, Instant now) {
        upsertIntegration(companyId, now, "webmotors", "Webmotors / Estoque e Leads", "CONNECTED", "Loja Prime Seminovos", "wm-prime");
        upsertIntegration(companyId, now, "olx-autos", "OLX Autos", "CONNECTED", "Loja Prime Seminovos", "olx-prime");
        upsertIntegration(companyId, now, "icarros", "iCarros", "ACTIVE", "Loja Prime Seminovos", "icarros-prime");
        upsertIntegration(companyId, now, "mercadolivre", "Mercado Livre", "CONNECTED", "Loja Prime Seminovos", "meli-prime");
    }

    private void upsertIntegration(
            UUID companyId,
            Instant now,
            String providerKey,
            String displayName,
            String status,
            String accountName,
            String username
    ) {
        JpaIoAutoIntegrationEntity entity = integrations.findByCompanyIdAndProviderKeyIgnoreCase(companyId, providerKey)
                .orElseGet(JpaIoAutoIntegrationEntity::new);
        if (entity.getId() == null) {
            entity.setId(uuidFor(companyId, "integration:" + providerKey));
            entity.setCompanyId(companyId);
            entity.setCreatedAt(now);
        }
        entity.setProviderKey(providerKey);
        entity.setDisplayName(displayName);
        entity.setStatus(status);
        entity.setAccountName(accountName);
        entity.setUsername(username);
        entity.setEndpointUrl("https://api." + providerKey.replace("_", "-") + ".demo.ioauto.local");
        entity.setApiToken("demo-token-" + providerKey);
        entity.setWebhookSecret("demo-webhook-" + providerKey);
        entity.setSettingsJson("{}");
        entity.setLastError(null);
        entity.setLastSyncAt(now.minus(2, ChronoUnit.HOURS));
        entity.setUpdatedAt(now);
        integrations.save(entity);
    }

    private Map<String, JpaIoAutoVehicleEntity> seedVehicles(UUID companyId, Instant now) {
        List<VehicleSeed> seeds = List.of(
                new VehicleSeed("IO-001", "Jeep Compass Longitude 1.3 Turbo", "Jeep", "Compass", "Longitude", 2024, 2023, 189_900_00L, 18_400, "Automatico", "Flex", "SUV", "Preto Vulcano", "7", "Sao Paulo", "SP", true, "PUBLISHED", image("jeep-compass"), List.of("Teto solar", "Banco eletrico", "Camera 360"), "SUV premium pronto para showroom."),
                new VehicleSeed("IO-002", "Toyota Corolla XEi 2.0 Flex", "Toyota", "Corolla", "XEi", 2023, 2023, 149_900_00L, 29_800, "Automatico", "Flex", "Sedan", "Prata Lunar", "1", "Sao Paulo", "SP", false, "PUBLISHED", image("toyota-corolla"), List.of("Multimidia", "Piloto automatico", "Chave presencial"), "Sedan com historico impecavel e revisoes em dia."),
                new VehicleSeed("IO-003", "Volkswagen T-Cross Highline 250 TSI", "Volkswagen", "T-Cross", "Highline", 2024, 2024, 168_500_00L, 9_900, "Automatico", "Flex", "SUV", "Cinza Platinum", "8", "Barueri", "SP", true, "PUBLISHED", image("vw-tcross"), List.of("ACC", "Painel digital", "Carregador por inducao"), "SUV destaque da semana com baixa quilometragem."),
                new VehicleSeed("IO-004", "BMW 320i GP 2.0 Turbo", "BMW", "320i", "GP", 2022, 2022, 229_900_00L, 35_200, "Automatico", "Flex", "Sedan", "Branco Alpino", "4", "Santo Andre", "SP", false, "PUBLISHED", image("bmw-320i"), List.of("Interior caramelo", "Farol full LED", "Som premium"), "Sedan executivo com visual premium para campanha."),
                new VehicleSeed("IO-005", "Chevrolet Onix Premier 1.0 Turbo", "Chevrolet", "Onix", "Premier", 2023, 2023, 96_900_00L, 22_100, "Automatico", "Flex", "Hatch", "Vermelho Carmim", "3", "Campinas", "SP", false, "READY", image("chevrolet-onix"), List.of("Wifi nativo", "Sensor de estacionamento", "Partida remota"), "Compacto ideal para campanhas de entrada."),
                new VehicleSeed("IO-006", "Fiat Toro Volcano Turbo 270", "Fiat", "Toro", "Volcano", 2024, 2024, 176_900_00L, 12_800, "Automatico", "Flex", "Picape", "Cinza Silverstone", "9", "Osasco", "SP", true, "READY", image("fiat-toro"), List.of("Capota maritima", "Santo Antonio", "Midia de 10 polegadas"), "Picape pronta para destaque no feed comercial."),
                new VehicleSeed("IO-007", "Honda HR-V EXL 1.5 Turbo", "Honda", "HR-V", "EXL", 2024, 2024, 184_900_00L, 7_400, "Automatico", "Flex", "SUV", "Azul Cosmos", "2", "Sao Bernardo do Campo", "SP", false, "SOLD", image("honda-hrv"), List.of("Pacote ADAS", "Couro bege", "Ar digital"), "Veiculo ja vendido para alimentar os indicadores."),
                new VehicleSeed("IO-008", "Ram Rampage Laramie 2.0 Turbo", "Ram", "Rampage", "Laramie", 2024, 2024, 264_900_00L, 5_200, "Automatico", "Diesel", "Picape", "Preto Diamond", "5", "Guarulhos", "SP", true, "SOLD", image("ram-rampage"), List.of("Bancos ventilados", "Som premium", "Camera 360"), "Picape vendida para compor o ranking comercial."),
                new VehicleSeed("IO-009", "Nissan Kicks Exclusive 1.6", "Nissan", "Kicks", "Exclusive", 2023, 2023, 118_900_00L, 19_600, "Automatico", "Flex", "SUV", "Branco Diamond", "0", "Sao Paulo", "SP", false, "DRAFT", image("nissan-kicks"), List.of("Partida por botao", "Chave presencial", "Visao 360"), "Cadastro em refinamento para a proxima leva de anuncios.")
        );

        Map<String, JpaIoAutoVehicleEntity> vehiclesByCode = new LinkedHashMap<>();
        for (int index = 0; index < seeds.size(); index++) {
            VehicleSeed seed = seeds.get(index);
            Instant updatedAt = now.minus(index + 1L, ChronoUnit.HOURS);
            UUID vehicleId = uuidFor(companyId, "vehicle:" + seed.stockNumber());
            JpaIoAutoVehicleEntity entity = vehicles.findById(vehicleId).orElseGet(JpaIoAutoVehicleEntity::new);
            if (entity.getId() == null) {
                entity.setId(vehicleId);
                entity.setCompanyId(companyId);
                entity.setCreatedAt(updatedAt.minus(14, ChronoUnit.DAYS));
            }
            entity.setStockNumber(seed.stockNumber());
            entity.setTitle(seed.title());
            entity.setBrand(seed.brand());
            entity.setModel(seed.model());
            entity.setVersion(seed.version());
            entity.setModelYear(seed.modelYear());
            entity.setManufactureYear(seed.manufactureYear());
            entity.setPriceCents(seed.priceCents());
            entity.setMileage(seed.mileage());
            entity.setTransmission(seed.transmission());
            entity.setFuelType(seed.fuelType());
            entity.setBodyType(seed.bodyType());
            entity.setColor(seed.color());
            entity.setPlateFinal(seed.plateFinal());
            entity.setCity(seed.city());
            entity.setState(seed.state());
            entity.setFeatured(seed.featured());
            entity.setStatus(seed.status());
            entity.setDescription(seed.description());
            entity.setCoverImageUrl(seed.coverImageUrl());
            entity.setGalleryJson(writeJson(List.of(seed.coverImageUrl(), seed.coverImageUrl() + "&variant=2")));
            entity.setOptionalsJson(writeJson(seed.optionals()));
            entity.setUpdatedAt(updatedAt);
            vehicles.save(entity);
            vehiclesByCode.put(seed.stockNumber(), entity);
        }
        return vehiclesByCode;
    }

    private int seedPublications(UUID companyId, Map<String, JpaIoAutoVehicleEntity> vehiclesByCode, Instant now) {
        List<PublicationSeed> seeds = List.of(
                new PublicationSeed("IO-001", "webmotors", "PUBLISHED", "WM-1001", "https://www.webmotors.com.br/comprar/jeep/compass", 8),
                new PublicationSeed("IO-001", "olx-autos", "PUBLISHED", "OLX-1001", "https://www.olx.com.br/autos-e-pecas/compass", 6),
                new PublicationSeed("IO-002", "webmotors", "PUBLISHED", "WM-1002", "https://www.webmotors.com.br/comprar/toyota/corolla", 10),
                new PublicationSeed("IO-003", "webmotors", "PUBLISHED", "WM-1003", "https://www.webmotors.com.br/comprar/volkswagen/t-cross", 4),
                new PublicationSeed("IO-003", "mercadolivre", "SYNC_IN_PROGRESS", "ML-1003", "https://www.mercadolivre.com.br/t-cross", 2),
                new PublicationSeed("IO-004", "icarros", "PUBLISHED", "IC-1004", "https://www.icarros.com.br/bmw-320i", 12),
                new PublicationSeed("IO-004", "webmotors", "READY_TO_SYNC", "WM-1004", "https://www.webmotors.com.br/comprar/bmw/320i", 1),
                new PublicationSeed("IO-005", "olx-autos", "READY_TO_SYNC", "OLX-1005", "https://www.olx.com.br/autos-e-pecas/onix", 0),
                new PublicationSeed("IO-006", "webmotors", "WAITING_CONFIGURATION", "WM-1006", "https://www.webmotors.com.br/comprar/fiat/toro", 0),
                new PublicationSeed("IO-007", "webmotors", "SOLD", "WM-1007", "https://www.webmotors.com.br/comprar/honda/hr-v", 18),
                new PublicationSeed("IO-008", "olx-autos", "SOLD", "OLX-1008", "https://www.olx.com.br/autos-e-pecas/rampage", 15)
        );

        int count = 0;
        for (PublicationSeed seed : seeds) {
            JpaIoAutoVehicleEntity vehicle = vehiclesByCode.get(seed.vehicleStockNumber());
            if (vehicle == null) continue;
            JpaIoAutoVehiclePublicationEntity entity = publications
                    .findByCompanyIdAndVehicleIdAndProviderKey(companyId, vehicle.getId(), seed.providerKey())
                    .orElseGet(JpaIoAutoVehiclePublicationEntity::new);
            Instant publishedAt = now.minus(seed.publishedDaysAgo(), ChronoUnit.DAYS);
            if (entity.getId() == null) {
                entity.setId(uuidFor(companyId, "publication:" + seed.vehicleStockNumber() + ":" + seed.providerKey()));
                entity.setCompanyId(companyId);
                entity.setVehicleId(vehicle.getId());
                entity.setCreatedAt(publishedAt);
            }
            entity.setProviderKey(seed.providerKey());
            entity.setProviderListingId(seed.providerListingId());
            entity.setExternalUrl(seed.externalUrl());
            entity.setStatus(seed.status());
            entity.setLastError(null);
            entity.setPublishedAt("WAITING_CONFIGURATION".equals(seed.status()) ? null : publishedAt);
            entity.setSyncedAt(now.minus(90, ChronoUnit.MINUTES));
            entity.setUpdatedAt(now.minus(30, ChronoUnit.MINUTES));
            publications.save(entity);
            count += 1;
        }
        return count;
    }

    private int seedConversations(
            UUID companyId,
            JpaTeamEntity salesTeam,
            Map<String, JpaUserEntity> sellersByKey,
            Map<String, JpaIoAutoVehicleEntity> vehiclesByCode,
            Instant now
    ) {
        List<ConversationSeed> seeds = List.of(
                new ConversationSeed("Ana Paula", "5511999000101", "WEBMOTORS", "IN_PROGRESS", "mariana", 2, "Gostei bastante do Compass. Consegue fechar hoje?", "IO-001", false, null),
                new ConversationSeed("Carlos Eduardo", "5511999000102", "OLX_AUTOS", "NEW", "lucas", 1, "Quero saber a kilometragem real do Corolla.", "IO-002", false, null),
                new ConversationSeed("Fernanda Lima", "5511999000103", "WEBMOTORS", "IN_PROGRESS", "rafael", 5, "Podemos agendar test drive para amanha de manha?", "IO-003", false, null),
                new ConversationSeed("Gustavo Rocha", "5511999000104", "ICARROS", "IN_PROGRESS", "mariana", 7, "Se aprovar a troca, eu fico com a BMW.", "IO-004", false, null),
                new ConversationSeed("Juliana Martins", "5511999000105", "WEBMOTORS", "IN_PROGRESS", "lucas", 12, "Fechamos o HR-V. Pode preparar o contrato.", "IO-007", true, 10),
                new ConversationSeed("Marcelo Tavares", "5511999000106", "OLX_AUTOS", "IN_PROGRESS", "rafael", 18, "Aprovado. Vou retirar a Rampage no sabado.", "IO-008", true, 16),
                new ConversationSeed("Patricia Soares", "5511999000107", "WEBMOTORS", "NEW", "mariana", 0, "Tenho interesse na Toro. Ela ja esta anunciada?", "IO-006", false, null),
                new ConversationSeed("Renato Alves", "5511999000108", "MERCADOLIVRE", "IN_PROGRESS", "lucas", 9, "Gostei do Onix para a minha esposa.", "IO-005", false, null),
                new ConversationSeed("Tatiane Nunes", "5511999000109", "WEBMOTORS", "IN_PROGRESS", "rafael", 3, "Esse T-Cross aceita financiamento com entrada menor?", "IO-003", false, null)
        );

        List<JpaAtendimentoConversationEntity> conversationEntities = new ArrayList<>();
        List<JpaAtendimentoMessageEntity> messageEntities = new ArrayList<>();
        List<JpaAtendimentoSessionEntity> sessionEntities = new ArrayList<>();

        for (ConversationSeed seed : seeds) {
            JpaUserEntity seller = sellersByKey.get(seed.sellerKey());
            JpaIoAutoVehicleEntity interestedVehicle = vehiclesByCode.get(seed.vehicleStockNumber());
            Instant arrivedAt = now.minus(seed.arrivedDaysAgo(), ChronoUnit.DAYS).minus(2, ChronoUnit.HOURS);
            Instant startedAt = arrivedAt.plus(20, ChronoUnit.MINUTES);
            Instant lastMessageAt = startedAt.plus(95, ChronoUnit.MINUTES);

            JpaAtendimentoConversationEntity conversation = conversations.findByCompanyIdAndPhone(companyId, seed.phone())
                    .orElseGet(JpaAtendimentoConversationEntity::new);
            if (conversation.getId() == null) {
                conversation.setId(uuidFor(companyId, "conversation:" + seed.phone()));
                conversation.setCompanyId(companyId);
                conversation.setCreatedAt(arrivedAt);
            }
            conversation.setPhone(seed.phone());
            conversation.setDisplayName(seed.contactName());
            conversation.setContactPhotoUrl("https://i.pravatar.cc/180?u=" + seed.phone());
            conversation.setContactLid(seed.phone());
            conversation.setSourcePlatform(seed.sourcePlatform());
            conversation.setSourceReference("lead-" + seed.phone().substring(seed.phone().length() - 4));
            conversation.setStatus(seed.status());
            conversation.setAssignedTeamId(salesTeam.getId());
            conversation.setAssignedUserId(seller.getId());
            conversation.setAssignedUserName(seller.getFullName());
            conversation.setAssignedAgentId(null);
            conversation.setHumanHandoffRequested(false);
            conversation.setHumanHandoffQueue(null);
            conversation.setHumanHandoffRequestedAt(null);
            conversation.setHumanUserChoiceRequired(false);
            conversation.setHumanChoiceOptionsJson("[]");
            conversation.setPresenceStatus("online");
            conversation.setPresenceLastSeen(lastMessageAt.minus(3, ChronoUnit.MINUTES));
            conversation.setPresenceUpdatedAt(lastMessageAt.minus(3, ChronoUnit.MINUTES));
            conversation.setStartedAt("NEW".equals(seed.status()) ? null : startedAt);
            conversation.setLastMessageText(seed.lastMessage());
            conversation.setLastMessageAt(lastMessageAt);
            conversation.setUpdatedAt(lastMessageAt);
            conversationEntities.add(conversation);

            Instant firstCustomerMessageAt = arrivedAt.plus(5, ChronoUnit.MINUTES);
            messageEntities.add(textMessage(companyId, conversation.getId(), seed.phone(), false, "Oi, vim pelo anuncio do " + interestedVehicle.getTitle() + ".", firstCustomerMessageAt));
            messageEntities.add(textMessage(companyId, conversation.getId(), seed.phone(), true, "Perfeito, " + seed.contactName() + ". Estou te passando os detalhes agora.", firstCustomerMessageAt.plus(12, ChronoUnit.MINUTES)));
            messageEntities.add(textMessage(companyId, conversation.getId(), seed.phone(), false, seed.lastMessage(), lastMessageAt.minus(8, ChronoUnit.MINUTES)));
            messageEntities.add(imageMessage(companyId, conversation.getId(), seed.phone(), true, "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80", lastMessageAt));

            JpaAtendimentoSessionEntity session = sessions.findFirstByCompanyIdAndConversationIdOrderByArrivedAtDescCreatedAtDesc(companyId, conversation.getId())
                    .orElseGet(JpaAtendimentoSessionEntity::new);
            if (session.getId() == null) {
                session.setId(uuidFor(companyId, "session:" + seed.phone()));
                session.setCompanyId(companyId);
                session.setConversationId(conversation.getId());
                session.setCreatedAt(arrivedAt);
            }
            session.setChannelId(seed.sourcePlatform().toLowerCase(Locale.ROOT));
            session.setChannelName(sourceLabel(seed.sourcePlatform()));
            session.setResponsibleTeamId(salesTeam.getId());
            session.setResponsibleTeamName(salesTeam.getName());
            session.setResponsibleUserId(seller.getId());
            session.setResponsibleUserName(seller.getFullName());
            session.setArrivedAt(arrivedAt);
            session.setStartedAt(startedAt);
            session.setFirstResponseAt(startedAt.plus(4, ChronoUnit.MINUTES));
            if (seed.saleCompleted() && seed.saleCompletedDaysAgo() != null) {
                Instant saleCompletedAt = now.minus(seed.saleCompletedDaysAgo(), ChronoUnit.DAYS).plus(3, ChronoUnit.HOURS);
                session.setCompletedAt(saleCompletedAt);
                session.setClassificationResult(AtendimentoClassificationResult.OBJECTIVE_ACHIEVED);
                session.setClassificationLabel("Venda concluida");
                session.setSaleCompleted(true);
                session.setSoldVehicleId(interestedVehicle.getId());
                session.setSoldVehicleTitle(interestedVehicle.getTitle());
                session.setSaleCompletedAt(saleCompletedAt);
                session.setStatus(AtendimentoSessionStatus.COMPLETED);
            } else {
                session.setCompletedAt(null);
                session.setClassificationResult(null);
                session.setClassificationLabel(null);
                session.setSaleCompleted(false);
                session.setSoldVehicleId(null);
                session.setSoldVehicleTitle(null);
                session.setSaleCompletedAt(null);
                session.setStatus("NEW".equals(seed.status()) ? AtendimentoSessionStatus.PENDING : AtendimentoSessionStatus.IN_PROGRESS);
            }
            session.setUpdatedAt(seed.saleCompleted() && seed.saleCompletedDaysAgo() != null
                    ? now.minus(seed.saleCompletedDaysAgo(), ChronoUnit.DAYS).plus(3, ChronoUnit.HOURS)
                    : lastMessageAt);
            sessionEntities.add(session);
        }

        conversations.saveAll(conversationEntities);
        messages.saveAll(messageEntities);
        sessions.saveAll(sessionEntities);
        return conversationEntities.size();
    }

    private JpaAtendimentoMessageEntity textMessage(
            UUID companyId,
            UUID conversationId,
            String phone,
            boolean fromMe,
            String text,
            Instant createdAt
    ) {
        JpaAtendimentoMessageEntity entity = new JpaAtendimentoMessageEntity();
        entity.setId(uuidFor(companyId, "message:text:" + conversationId + ":" + createdAt.toEpochMilli() + ":" + fromMe));
        entity.setCompanyId(companyId);
        entity.setConversationId(conversationId);
        entity.setPhone(phone);
        entity.setMessageText(text);
        entity.setMessageType("text");
        entity.setFromMe(fromMe);
        entity.setStatus(fromMe ? "DELIVERED" : "RECEIVED");
        entity.setMoment(createdAt.toEpochMilli());
        entity.setPayloadJson("{}");
        entity.setCreatedAt(createdAt);
        return entity;
    }

    private JpaAtendimentoMessageEntity imageMessage(
            UUID companyId,
            UUID conversationId,
            String phone,
            boolean fromMe,
            String imageUrl,
            Instant createdAt
    ) {
        JpaAtendimentoMessageEntity entity = new JpaAtendimentoMessageEntity();
        entity.setId(uuidFor(companyId, "message:image:" + conversationId + ":" + createdAt.toEpochMilli()));
        entity.setCompanyId(companyId);
        entity.setConversationId(conversationId);
        entity.setPhone(phone);
        entity.setMessageText("Segue o material do veiculo para voce avaliar.");
        entity.setMessageType("image");
        entity.setFromMe(fromMe);
        entity.setStatus("DELIVERED");
        entity.setMoment(createdAt.toEpochMilli());
        entity.setPayloadJson("{\"image\":{\"imageUrl\":\"" + imageUrl + "\"}}");
        entity.setCreatedAt(createdAt);
        return entity;
    }

    private void seedBilling(UUID companyId, Instant now) {
        JpaIoAutoBillingSubscriptionEntity entity = subscriptions.findTopByCompanyIdOrderByUpdatedAtDesc(companyId)
                .orElseGet(JpaIoAutoBillingSubscriptionEntity::new);
        if (entity.getId() == null) {
            entity.setId(uuidFor(companyId, "billing:showcase"));
            entity.setCompanyId(companyId);
            entity.setCreatedAt(now.minus(22, ChronoUnit.DAYS));
        }
        entity.setProvider("asaas");
        entity.setProviderCustomerId("cus_demo_" + companyId.toString().substring(0, 8));
        entity.setProviderSubscriptionId("sub_demo_" + companyId.toString().substring(0, 8));
        entity.setProviderPriceId("price_ioauto_professional");
        entity.setPlanKey("ioauto-professional");
        entity.setPlanName("Plano Profissional");
        entity.setStatus("ACTIVE");
        entity.setAmountCents(499_00L);
        entity.setCurrency("BRL");
        entity.setBillingInterval("monthly");
        entity.setCurrentPeriodEnd(now.plus(19, ChronoUnit.DAYS));
        entity.setCancelAtPeriodEnd(false);
        entity.setCheckoutSessionId("chk_demo_" + companyId.toString().substring(0, 8));
        entity.setUpdatedAt(now);
        subscriptions.save(entity);
    }

    private void seedCrm(UUID companyId, Instant now) {
        List<Map<String, Object>> stages = List.of(
                stage("entrada", "Entrada", "initial", 0, now),
                stage("qualificacao", "Qualificacao", "intermediate", 1, now),
                stage("proposta", "Proposta", "intermediate", 2, now),
                stage("test-drive", "Test drive", "intermediate", 3, now),
                stage("fechamento", "Fechamento", "final", 4, now),
                stage("ganhos", "Ganhos", "final", 5, now)
        );

        List<Map<String, Object>> customFields = List.of(
                customField("crm_field_value", "Valor", "number", 0, now),
                customField("field_vehicle_interest", "Veiculo de interesse", "text", 1, now),
                customField("field_origin_summary", "Origem resumida", "text", 2, now),
                customField("field_next_step", "Proximo passo", "textarea", 3, now)
        );

        Map<String, String> leadStageMap = Map.of(
                uuidFor(companyId, "conversation:5511999000101").toString(), "proposta",
                uuidFor(companyId, "conversation:5511999000102").toString(), "qualificacao",
                uuidFor(companyId, "conversation:5511999000103").toString(), "test-drive",
                uuidFor(companyId, "conversation:5511999000104").toString(), "fechamento",
                uuidFor(companyId, "conversation:5511999000105").toString(), "ganhos",
                uuidFor(companyId, "conversation:5511999000106").toString(), "ganhos",
                uuidFor(companyId, "conversation:5511999000107").toString(), "entrada",
                uuidFor(companyId, "conversation:5511999000108").toString(), "proposta",
                uuidFor(companyId, "conversation:5511999000109").toString(), "qualificacao"
        );

        Map<String, Map<String, String>> leadFieldValues = new LinkedHashMap<>();
        leadFieldValues.put(uuidFor(companyId, "conversation:5511999000101").toString(), crmFields("189900.00", "Jeep Compass Longitude 1.3 Turbo", "WebMotors", "Negociar entrada e fechamento ainda hoje."));
        leadFieldValues.put(uuidFor(companyId, "conversation:5511999000102").toString(), crmFields("149900.00", "Toyota Corolla XEi 2.0 Flex", "OLX Autos", "Enviar video completo e laudo cautelar."));
        leadFieldValues.put(uuidFor(companyId, "conversation:5511999000103").toString(), crmFields("168500.00", "Volkswagen T-Cross Highline 250 TSI", "WebMotors", "Confirmar horario do test drive e reservar o carro."));
        leadFieldValues.put(uuidFor(companyId, "conversation:5511999000104").toString(), crmFields("229900.00", "BMW 320i GP 2.0 Turbo", "iCarros", "Ajustar proposta final com avaliacao do usado."));
        leadFieldValues.put(uuidFor(companyId, "conversation:5511999000105").toString(), crmFields("184900.00", "Honda HR-V EXL 1.5 Turbo", "WebMotors", "Venda concluida e aguardando entrega."));
        leadFieldValues.put(uuidFor(companyId, "conversation:5511999000106").toString(), crmFields("264900.00", "Ram Rampage Laramie 2.0 Turbo", "OLX Autos", "Venda concluida com retirada agendada."));
        leadFieldValues.put(uuidFor(companyId, "conversation:5511999000107").toString(), crmFields("176900.00", "Fiat Toro Volcano Turbo 270", "WebMotors", "Validar interesse real e enviar mais fotos."));
        leadFieldValues.put(uuidFor(companyId, "conversation:5511999000108").toString(), crmFields("96900.00", "Chevrolet Onix Premier 1.0 Turbo", "Mercado Livre", "Mandar simulacao e reservar avaliacao."));
        leadFieldValues.put(uuidFor(companyId, "conversation:5511999000109").toString(), crmFields("168500.00", "Volkswagen T-Cross Highline 250 TSI", "WebMotors", "Coletar dados de financiamento e renda."));

        JpaCrmCompanyStateEntity entity = crmState.findById(companyId).orElseGet(JpaCrmCompanyStateEntity::new);
        if (entity.getCompanyId() == null) {
            entity.setCompanyId(companyId);
            entity.setCreatedAt(now);
        }
        entity.setStagesJson(writeJson(stages));
        entity.setLeadStageMapJson(writeJson(leadStageMap));
        entity.setCustomFieldsJson(writeJson(customFields));
        entity.setLeadFieldValuesJson(writeJson(leadFieldValues));
        entity.setLeadFieldsOrderJson(writeJson(List.of(
                "custom:crm_field_value",
                "custom:field_vehicle_interest",
                "custom:field_origin_summary",
                "custom:field_next_step"
        )));
        entity.setUpdatedAt(now);
        crmState.save(entity);
    }

    private Map<String, Object> stage(String id, String title, String kind, int order, Instant now) {
        return Map.of(
                "id", id,
                "title", title,
                "kind", kind,
                "order", order,
                "createdAt", now.toString(),
                "updatedAt", now.toString()
        );
    }

    private Map<String, Object> customField(String id, String label, String type, int order, Instant now) {
        return Map.of(
                "id", id,
                "label", label,
                "type", type,
                "order", order,
                "createdAt", now.toString(),
                "updatedAt", now.toString()
        );
    }

    private Map<String, String> crmFields(String value, String vehicleInterest, String originSummary, String nextStep) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("crm_field_value", value);
        values.put("field_vehicle_interest", vehicleInterest);
        values.put("field_origin_summary", originSummary);
        values.put("field_next_step", nextStep);
        return values;
    }

    private String sourceLabel(String sourcePlatform) {
        return switch (normalize(sourcePlatform).toUpperCase(Locale.ROOT)) {
            case "WEBMOTORS" -> "WebMotors";
            case "OLX_AUTOS" -> "OLX Autos";
            case "ICARROS" -> "iCarros";
            case "MERCADOLIVRE" -> "Mercado Livre";
            default -> "Marketplace";
        };
    }

    private String image(String slug) {
        return "https://images.unsplash.com/" + switch (slug) {
            case "jeep-compass" -> "photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80";
            case "toyota-corolla" -> "photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80";
            case "vw-tcross" -> "photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80";
            case "bmw-320i" -> "photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80";
            case "chevrolet-onix" -> "photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80";
            case "fiat-toro" -> "photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80";
            case "honda-hrv" -> "photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80";
            case "ram-rampage" -> "photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=80";
            case "nissan-kicks" -> "photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1200&q=80";
            default -> "photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=80";
        };
    }

    private UUID uuidFor(UUID companyId, String key) {
        return UUID.nameUUIDFromBytes((companyId + ":" + key).getBytes(StandardCharsets.UTF_8));
    }

    private String writeJson(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (Exception exception) {
            throw new BusinessException("DEV_SHOWCASE_JSON_FAILED", "Nao foi possivel montar os dados ficticios do showroom.");
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    public record ShowcaseSeedResult(
            UUID companyId,
            String companyName,
            int vehicleCount,
            int publicationCount,
            int conversationCount,
            List<String> demoUserEmails
    ) {
    }

    private record VehicleSeed(
            String stockNumber,
            String title,
            String brand,
            String model,
            String version,
            int modelYear,
            int manufactureYear,
            long priceCents,
            int mileage,
            String transmission,
            String fuelType,
            String bodyType,
            String color,
            String plateFinal,
            String city,
            String state,
            boolean featured,
            String status,
            String coverImageUrl,
            List<String> optionals,
            String description
    ) {
    }

    private record PublicationSeed(
            String vehicleStockNumber,
            String providerKey,
            String status,
            String providerListingId,
            String externalUrl,
            int publishedDaysAgo
    ) {
    }

    private record ConversationSeed(
            String contactName,
            String phone,
            String sourcePlatform,
            String status,
            String sellerKey,
            int arrivedDaysAgo,
            String lastMessage,
            String vehicleStockNumber,
            boolean saleCompleted,
            Integer saleCompletedDaysAgo
    ) {
    }
}
