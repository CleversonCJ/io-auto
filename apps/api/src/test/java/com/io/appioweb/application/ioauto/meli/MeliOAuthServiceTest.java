package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliOAuthStateStore;
import com.io.appioweb.adapters.integrations.mercadolivre.MeliProperties;
import com.io.appioweb.adapters.integrations.mercadolivre.MeliAuthorizationRevocationClient;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MeliOAuthServiceTest {

    @Test
    void buildAuthorizationUrlUsesConfiguredRedirectAndSecureState() {
        MeliProperties properties = new MeliProperties();
        properties.setClientId("client-123");
        properties.setClientSecret("secret-123");
        properties.setRedirectUri("https://api.example.test/api/integrations/mercadolivre/oauth/callback");
        properties.setAuthBaseUrl("https://auth.mercadolivre.com.br");
        properties.setApiBaseUrl("https://api.mercadolibre.com");
        properties.setSiteId("MLB");
        properties.setCurrencyId("BRL");

        MeliOAuthStateStore stateStore = mock(MeliOAuthStateStore.class);
        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        when(stateStore.create(companyId)).thenReturn("state-123");
        when(stateStore.consumeForReadOnly("state-123")).thenReturn(
                new MeliOAuthStateStore.StatePayload(
                        companyId,
                        "nonce-123",
                        "verifier-1234567890",
                        java.time.Instant.parse("2026-05-07T17:00:00Z")
                )
        );

        MeliOAuthService service = new MeliOAuthService(
                properties,
                stateStore,
                mock(MeliAccountService.class),
                mock(MeliTokenService.class),
                mock(MeliAuthorizationRevocationClient.class),
                mock(RestClient.class),
                "https://app.example.test"
        );

        MeliOAuthService.AuthorizationUrlResponse response = service.buildAuthorizationUrl(companyId);

        assertThat(response.state()).isEqualTo("state-123");
        assertThat(response.url()).contains("response_type=code");
        assertThat(response.url()).contains("client_id=client-123");
        assertThat(response.url()).contains("state=state-123");
        assertThat(response.url()).contains("code_challenge=");
        assertThat(response.url()).contains("code_challenge_method=S256");
        assertThat(response.url()).contains("redirect_uri=https%3A%2F%2Fapi.example.test%2Fapi%2Fintegrations%2Fmercadolivre%2Foauth%2Fcallback");
        verify(stateStore).create(companyId);
    }

    @Test
    void disconnectRevokesRemoteAuthorizationBeforeClearingLocalTokens() {
        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        MeliProperties properties = configuredProperties();
        MeliAccountService accountService = mock(MeliAccountService.class);
        MeliTokenService tokenService = mock(MeliTokenService.class);
        MeliAuthorizationRevocationClient revocationClient = mock(MeliAuthorizationRevocationClient.class);
        when(accountService.getStatus(companyId)).thenReturn(connectedStatus(companyId));
        when(tokenService.getValidAccessToken(companyId)).thenReturn("access-123");
        when(revocationClient.revoke(987654321L, "client-123", "access-123"))
                .thenReturn(MeliAuthorizationRevocationClient.RevocationOutcome.REVOKED);

        MeliOAuthService service = new MeliOAuthService(
                properties,
                mock(MeliOAuthStateStore.class),
                accountService,
                tokenService,
                revocationClient,
                mock(RestClient.class),
                "https://app.example.test"
        );

        MeliOAuthService.DisconnectResult result = service.disconnect(companyId);

        assertThat(result.remotelyRevoked()).isTrue();
        assertThat(result.message()).contains("revogada");
        var ordered = inOrder(accountService, tokenService, revocationClient);
        ordered.verify(accountService).getStatus(companyId);
        ordered.verify(tokenService).getValidAccessToken(companyId);
        ordered.verify(revocationClient).revoke(987654321L, "client-123", "access-123");
        ordered.verify(accountService).disconnect(companyId);
    }

    @Test
    void disconnectRefreshesTokenAndRetriesRevocationWhenMercadoLivreReturnsUnauthorized() {
        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        MeliProperties properties = configuredProperties();
        MeliAccountService accountService = mock(MeliAccountService.class);
        MeliTokenService tokenService = mock(MeliTokenService.class);
        MeliAuthorizationRevocationClient revocationClient = mock(MeliAuthorizationRevocationClient.class);
        when(accountService.getStatus(companyId)).thenReturn(connectedStatus(companyId));
        when(tokenService.getValidAccessToken(companyId)).thenReturn("access-expired");
        when(tokenService.refreshAccessToken(companyId)).thenReturn("access-refreshed");
        when(revocationClient.revoke(987654321L, "client-123", "access-expired"))
                .thenReturn(MeliAuthorizationRevocationClient.RevocationOutcome.UNAUTHORIZED);
        when(revocationClient.revoke(987654321L, "client-123", "access-refreshed"))
                .thenReturn(MeliAuthorizationRevocationClient.RevocationOutcome.REVOKED);

        MeliOAuthService service = new MeliOAuthService(
                properties,
                mock(MeliOAuthStateStore.class),
                accountService,
                tokenService,
                revocationClient,
                mock(RestClient.class),
                "https://app.example.test"
        );

        MeliOAuthService.DisconnectResult result = service.disconnect(companyId);

        assertThat(result.remotelyRevoked()).isTrue();
        verify(tokenService).refreshAccessToken(companyId);
        verify(revocationClient).revoke(987654321L, "client-123", "access-refreshed");
        verify(accountService).disconnect(companyId);
    }

    @Test
    void disconnectKeepsLocalTokensWhenRemoteRevocationTemporarilyFails() {
        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        MeliProperties properties = configuredProperties();
        MeliAccountService accountService = mock(MeliAccountService.class);
        MeliTokenService tokenService = mock(MeliTokenService.class);
        MeliAuthorizationRevocationClient revocationClient = mock(MeliAuthorizationRevocationClient.class);
        when(accountService.getStatus(companyId)).thenReturn(connectedStatus(companyId));
        when(tokenService.getValidAccessToken(companyId)).thenReturn("access-123");
        when(revocationClient.revoke(987654321L, "client-123", "access-123"))
                .thenThrow(new com.io.appioweb.shared.errors.BusinessException(
                        "MELI_REVOCATION_UNAVAILABLE",
                        "Não foi possível comunicar com o Mercado Livre para revogar a autorização."
                ));

        MeliOAuthService service = new MeliOAuthService(
                properties,
                mock(MeliOAuthStateStore.class),
                accountService,
                tokenService,
                revocationClient,
                mock(RestClient.class),
                "https://app.example.test"
        );

        assertThatThrownBy(() -> service.disconnect(companyId))
                .isInstanceOf(com.io.appioweb.shared.errors.BusinessException.class)
                .hasMessageContaining("comunicar");
        verify(accountService, never()).disconnect(companyId);
    }

    private static MeliProperties configuredProperties() {
        MeliProperties properties = new MeliProperties();
        properties.setClientId("client-123");
        properties.setClientSecret("secret-123");
        properties.setRedirectUri("https://api.example.test/api/integrations/mercadolivre/oauth/callback");
        properties.setAuthBaseUrl("https://auth.mercadolivre.com.br");
        properties.setApiBaseUrl("https://api.mercadolibre.com");
        return properties;
    }

    private static MeliAccountService.MeliConnectionSnapshot connectedStatus(UUID companyId) {
        return new MeliAccountService.MeliConnectionSnapshot(
                companyId,
                true,
                "CONNECTED",
                987654321L,
                "Loja Exemplo",
                "LOJAEXEMPLO",
                "MLB",
                null,
                java.time.Instant.parse("2026-08-17T12:00:00Z"),
                java.time.Instant.parse("2026-08-17T12:00:00Z"),
                true
        );
    }
}
