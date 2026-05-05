package com.io.appioweb.adapters.integrations.webmotors.rest;

import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCredentialSnapshot;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsFeatureFlags;
import org.junit.jupiter.api.Test;

import javax.net.ssl.SSLSession;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class WebmotorsRestTokenClientTest {

    @Test
    void getAccessTokenCachesResponseAndSanitizesJsonBody() {
        List<HttpRequest> requests = new ArrayList<>();
        WebmotorsRestTokenClient client = new WebmotorsRestTokenClient(request -> {
            requests.add(request);
            return new FakeHttpResponse(200, "{\"access_token\":\"rest-token-1\",\"expires_in\":3600}");
        });

        var first = client.getAccessToken(credentials());
        var second = client.getAccessToken(credentials());

        assertThat(first.payload().accessToken()).isEqualTo("rest-token-1");
        assertThat(second.payload().accessToken()).isEqualTo("rest-token-1");
        assertThat(requests).hasSize(1);
        assertThat(requests.getFirst().headers().firstValue("Authorization")).hasValueSatisfying(value -> assertThat(value).startsWith("Basic "));
        assertThat(requests.getFirst().headers().firstValue("client_id")).hasValue("client-id");
        assertThat(first.sanitizedRequest()).contains("\"password\":\"***\"");
        assertThat(first.sanitizedRequest()).doesNotContain("senha-rest");
    }

    private static WebmotorsCredentialSnapshot credentials() {
        return new WebmotorsCredentialSnapshot(
                UUID.randomUUID(),
                UUID.fromString("11111111-1111-1111-1111-111111111111"),
                "default",
                "Loja Teste",
                new WebmotorsFeatureFlags(true, true, true, true, true),
                "https://soap.example.test",
                "/auth",
                "/inventory",
                "/catalog",
                "12345678000190",
                "integracao@example.com",
                "senha-super-secreta",
                "https://rest.example.test/login",
                "https://rest.example.test/site/v1",
                "usuario-rest",
                "senha-rest",
                "client-id",
                "client-secret",
                "callback-secret"
        );
    }

    private record FakeHttpResponse(int statusCode, String body) implements HttpResponse<String> {
        @Override public HttpRequest request() { return null; }
        @Override public Optional<HttpResponse<String>> previousResponse() { return Optional.empty(); }
        @Override public HttpHeaders headers() { return HttpHeaders.of(java.util.Map.of(), (a, b) -> true); }
        @Override public Optional<SSLSession> sslSession() { return Optional.empty(); }
        @Override public URI uri() { return URI.create("https://example.test"); }
        @Override public HttpClient.Version version() { return HttpClient.Version.HTTP_1_1; }
    }
}
