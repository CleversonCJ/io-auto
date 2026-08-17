package com.io.appioweb.adapters.integrations.mercadolivre;

import com.io.appioweb.shared.errors.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withNoContent;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

class MeliAuthorizationRevocationClientTest {

    @Test
    void revokeSendsDeleteWithBearerToken() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.mercadolibre.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        MeliAuthorizationRevocationClient client = new MeliAuthorizationRevocationClient(builder.build());
        server.expect(requestTo("https://api.mercadolibre.com/users/987654321/applications/client-123"))
                .andExpect(method(HttpMethod.DELETE))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer access-123"))
                .andRespond(withNoContent());

        MeliAuthorizationRevocationClient.RevocationOutcome outcome = client.revoke(
                987654321L,
                "client-123",
                "access-123"
        );

        assertThat(outcome).isEqualTo(MeliAuthorizationRevocationClient.RevocationOutcome.REVOKED);
        server.verify();
    }

    @Test
    void revokeReturnsUnauthorizedSoCallerCanRefreshAndRetry() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.mercadolibre.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        MeliAuthorizationRevocationClient client = new MeliAuthorizationRevocationClient(builder.build());
        server.expect(requestTo("https://api.mercadolibre.com/users/987654321/applications/client-123"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        MeliAuthorizationRevocationClient.RevocationOutcome outcome = client.revoke(
                987654321L,
                "client-123",
                "access-expired"
        );

        assertThat(outcome).isEqualTo(MeliAuthorizationRevocationClient.RevocationOutcome.UNAUTHORIZED);
        server.verify();
    }

    @Test
    void revokeKeepsLocalConnectionRetryableWhenRemoteServiceFails() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.mercadolibre.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        MeliAuthorizationRevocationClient client = new MeliAuthorizationRevocationClient(builder.build());
        server.expect(requestTo("https://api.mercadolibre.com/users/987654321/applications/client-123"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        assertThatThrownBy(() -> client.revoke(987654321L, "client-123", "access-123"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("não permitiu revogar");
        server.verify();
    }
}
