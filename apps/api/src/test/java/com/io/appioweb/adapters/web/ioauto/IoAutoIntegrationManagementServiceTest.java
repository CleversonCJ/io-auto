package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoIntegrationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoIntegrationEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliAccountEntity;
import com.io.appioweb.adapters.persistence.ioauto.MeliAccountRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.OlxAccountRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsCredentialRepositoryJpa;
import com.io.appioweb.shared.errors.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IoAutoIntegrationManagementServiceTest {

    private static final UUID COMPANY_ID = UUID.fromString("e8431272-4398-493d-a3ac-70f9e6d12b41");

    @Mock
    private IoAutoIntegrationRepositoryJpa integrations;
    @Mock
    private MeliAccountRepositoryJpa meliAccounts;
    @Mock
    private OlxAccountRepositoryJpa olxAccounts;
    @Mock
    private WebmotorsCredentialRepositoryJpa webmotorsCredentials;

    private IoAutoIntegrationManagementService service;

    @BeforeEach
    void setUp() {
        service = new IoAutoIntegrationManagementService(
                integrations,
                meliAccounts,
                olxAccounts,
                webmotorsCredentials
        );
    }

    @Test
    void blocksDeletionWhenIntegrationStatusIsConnected() {
        JpaIoAutoIntegrationEntity integration = integration("olx", "CONNECTED");
        when(integrations.findByCompanyIdAndProviderKeyIgnoreCase(COMPANY_ID, "olx"))
                .thenReturn(Optional.of(integration));

        assertThatThrownBy(() -> service.deleteDisconnectedIntegration(COMPANY_ID, "OLX-AUTOS"))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code())
                        .isEqualTo("IOAUTO_INTEGRATION_CONNECTED"))
                .hasMessage("Desconecte a integracao antes de exclui-la.");

        verify(integrations, never()).delete(integration);
        verify(olxAccounts, never()).deleteAllByCompanyId(COMPANY_ID);
    }

    @Test
    void blocksDeletionWhenOAuthAccountIsStillActive() {
        JpaIoAutoIntegrationEntity integration = integration("mercadolivre", "CONFIGURATION_REQUIRED");
        JpaMeliAccountEntity account = new JpaMeliAccountEntity();
        account.setActive(true);
        account.setAccessToken("encrypted-access");
        account.setRefreshToken("encrypted-refresh");

        when(integrations.findByCompanyIdAndProviderKeyIgnoreCase(COMPANY_ID, "mercadolivre"))
                .thenReturn(Optional.of(integration));
        when(meliAccounts.findByCompanyId(COMPANY_ID)).thenReturn(Optional.of(account));

        assertThatThrownBy(() -> service.deleteDisconnectedIntegration(COMPANY_ID, "mercadolivre"))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code())
                        .isEqualTo("IOAUTO_INTEGRATION_CONNECTED"));

        verify(integrations, never()).delete(integration);
        verify(meliAccounts, never()).deleteAllByCompanyId(COMPANY_ID);
    }

    @Test
    void deletesOnlyTheCurrentTenantDisconnectedIntegrationAndCredentials() {
        JpaIoAutoIntegrationEntity integration = integration("olx", "CONFIGURATION_REQUIRED");
        when(integrations.findByCompanyIdAndProviderKeyIgnoreCase(COMPANY_ID, "olx"))
                .thenReturn(Optional.of(integration));
        when(olxAccounts.findByCompanyId(COMPANY_ID)).thenReturn(Optional.empty());

        service.deleteDisconnectedIntegration(COMPANY_ID, "olx-autos");

        verify(olxAccounts).deleteAllByCompanyId(COMPANY_ID);
        verify(integrations).delete(integration);
        verify(meliAccounts, never()).deleteAllByCompanyId(COMPANY_ID);
        verify(webmotorsCredentials, never()).deleteAllByCompanyId(COMPANY_ID);
    }

    @Test
    void marksWebmotorsAsConnectedOnlyAfterValidation() {
        when(integrations.findByCompanyIdAndProviderKeyIgnoreCase(COMPANY_ID, "webmotors"))
                .thenReturn(Optional.empty());

        service.markWebmotorsConnected(COMPANY_ID);

        verify(integrations).save(org.mockito.ArgumentMatchers.argThat(integration ->
                COMPANY_ID.equals(integration.getCompanyId())
                        && "webmotors".equals(integration.getProviderKey())
                        && "CONNECTED".equals(integration.getStatus())
                        && integration.getLastSyncAt() != null
        ));
    }

    @Test
    void disconnectsWebmotorsBeforeItCanBeDeleted() {
        JpaIoAutoIntegrationEntity integration = integration("webmotors", "CONNECTED");
        integration.setApiToken("secret");
        integration.setWebhookSecret("webhook");
        when(integrations.findByCompanyIdAndProviderKeyIgnoreCase(COMPANY_ID, "webmotors"))
                .thenReturn(Optional.of(integration));

        service.disconnectWebmotors(COMPANY_ID);

        verify(webmotorsCredentials).deleteAllByCompanyId(COMPANY_ID);
        verify(integrations).save(integration);
        assertThat(integration.getStatus()).isEqualTo("CONFIGURATION_REQUIRED");
        assertThat(integration.getApiToken()).isNull();
        assertThat(integration.getWebhookSecret()).isNull();
        assertThat(integration.getLastSyncAt()).isNull();
    }

    private JpaIoAutoIntegrationEntity integration(String providerKey, String status) {
        JpaIoAutoIntegrationEntity integration = new JpaIoAutoIntegrationEntity();
        integration.setId(UUID.randomUUID());
        integration.setCompanyId(COMPANY_ID);
        integration.setProviderKey(providerKey);
        integration.setDisplayName(providerKey);
        integration.setStatus(status);
        integration.setSettingsJson("{}");
        integration.setCreatedAt(Instant.now());
        integration.setUpdatedAt(Instant.now());
        return integration;
    }
}
