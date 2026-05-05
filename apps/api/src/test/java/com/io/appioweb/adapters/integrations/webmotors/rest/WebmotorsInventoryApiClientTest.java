package com.io.appioweb.adapters.integrations.webmotors.rest;

import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCredentialSnapshot;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsFeatureFlags;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsRestAccessToken;
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

class WebmotorsInventoryApiClientTest {

    @Test
    void fetchInventoryMapsArrayPayloadAndUsesRequiredHeaders() {
        List<HttpRequest> requests = new ArrayList<>();
        WebmotorsInventoryApiClient client = new WebmotorsInventoryApiClient(request -> {
            requests.add(request);
            return new FakeHttpResponse(200, """
                    [
                      {
                        "adId": "wm-100",
                        "title": "Honda Civic Touring",
                        "price": 129900,
                        "mileage": 45200,
                        "status": "ACTIVE",
                        "createdAt": "2026-04-20T10:00:00Z",
                        "updatedAt": "2026-04-22T12:00:00Z"
                      }
                    ]
                    """);
        });

        var transport = client.fetchInventory(credentials(), new WebmotorsRestAccessToken("token-123", 3600));

        assertThat(requests).hasSize(1);
        assertThat(requests.getFirst().uri().toString()).isEqualTo("https://rest.example.test/site/v1/estoque");
        assertThat(requests.getFirst().headers().firstValue("client_id")).hasValue("client-id");
        assertThat(requests.getFirst().headers().firstValue("access_token")).hasValue("token-123");
        assertThat(transport.payload().anuncios()).hasSize(1);
        assertThat(transport.payload().anuncios().getFirst().codigoAnuncio()).isEqualTo("wm-100");
        assertThat(transport.payload().anuncios().getFirst().titulo()).isEqualTo("Honda Civic Touring");
    }

    private static WebmotorsCredentialSnapshot credentials() {
        return new WebmotorsCredentialSnapshot(
                UUID.randomUUID(),
                UUID.randomUUID(),
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
