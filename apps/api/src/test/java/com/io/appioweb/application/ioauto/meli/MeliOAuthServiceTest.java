package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliOAuthStateStore;
import com.io.appioweb.adapters.integrations.mercadolivre.MeliProperties;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
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
        when(stateStore.create(UUID.fromString("11111111-1111-1111-1111-111111111111"))).thenReturn("state-123");

        MeliOAuthService service = new MeliOAuthService(
                properties,
                stateStore,
                mock(MeliAccountService.class),
                mock(MeliTokenService.class),
                mock(RestClient.class),
                "https://app.example.test"
        );

        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        MeliOAuthService.AuthorizationUrlResponse response = service.buildAuthorizationUrl(companyId);

        assertThat(response.state()).isEqualTo("state-123");
        assertThat(response.url()).contains("response_type=code");
        assertThat(response.url()).contains("client_id=client-123");
        assertThat(response.url()).contains("state=state-123");
        assertThat(response.url()).contains("redirect_uri=https%3A%2F%2Fapi.example.test%2Fapi%2Fintegrations%2Fmercadolivre%2Foauth%2Fcallback");
        verify(stateStore).create(companyId);
    }
}
