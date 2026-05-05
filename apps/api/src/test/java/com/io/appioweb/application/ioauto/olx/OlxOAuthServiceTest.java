package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.integrations.olx.OlxApiClient;
import com.io.appioweb.adapters.integrations.olx.OlxOAuthStateCodec;
import com.io.appioweb.adapters.integrations.olx.OlxProperties;
import com.io.appioweb.adapters.integrations.olx.OlxResponseParser;
import com.io.appioweb.adapters.security.SensitiveDataCrypto;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class OlxOAuthServiceTest {

    @Test
    void buildAuthorizationUrlUsesAutouploadScopeAndSignedState() {
        OlxProperties properties = new OlxProperties();
        properties.setClientId("client-123");
        properties.setClientSecret("secret-123");
        properties.setRedirectUri("https://api.example.test/api/integrations/olx/oauth/callback");
        properties.setAuthBaseUrl("https://auth.olx.com.br");

        SensitiveDataCrypto crypto = new SensitiveDataCrypto("olx-service-test-key-123456789");
        OlxOAuthStateCodec stateCodec = new OlxOAuthStateCodec(crypto);
        OlxOAuthService service = new OlxOAuthService(
                properties,
                stateCodec,
                mock(OlxApiClient.class),
                new OlxResponseParser(),
                mock(OlxAccountService.class),
                "https://app.example.test"
        );

        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        OlxOAuthService.AuthorizationUrlResponse response = service.buildAuthorizationUrl(companyId);

        assertThat(response.url()).contains("scope=autoupload");
        assertThat(response.url()).contains("client_id=client-123");
        assertThat(stateCodec.decode(response.state()).companyId()).isEqualTo(companyId);
    }
}
