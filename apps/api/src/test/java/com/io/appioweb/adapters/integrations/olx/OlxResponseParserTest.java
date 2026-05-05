package com.io.appioweb.adapters.integrations.olx;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OlxResponseParserTest {

    private final OlxResponseParser parser = new OlxResponseParser();

    @Test
    void parseImportStatusResponseReadsObjectAds() {
        OlxResponseParser.ImportStatusResponse response = parser.parseImportStatusResponse("""
                {
                  "autoupload_status": "queued",
                  "ads": {
                    "car_123": {
                      "status": "accepted",
                      "operation": "insert",
                      "list_id": "9001",
                      "url": "https://www.olx.com.br/ad/9001",
                      "message": [{"error": "NO_IMAGE"}]
                    }
                  }
                }
                """);

        assertThat(response.autouploadStatus()).isEqualTo("queued");
        assertThat(response.ads()).hasSize(1);
        assertThat(response.ads().getFirst().id()).isEqualTo("car_123");
        assertThat(response.ads().getFirst().status()).isEqualTo("accepted");
        assertThat(response.ads().getFirst().listId()).isEqualTo("9001");
        assertThat(response.ads().getFirst().messages()).containsExactly("NO_IMAGE");
    }

    @Test
    void parsePublishedAdStatusCollectsImageErrors() {
        OlxResponseParser.PublishedAdStatusResponse response = parser.parsePublishedAdStatus("""
                {
                  "status": "active",
                  "message": "ok",
                  "url": "https://www.olx.com.br/ad/9001",
                  "list_id": "9001",
                  "imageErrors": [
                    {
                      "imageUrl": "https://cdn.example.test/car.jpg",
                      "status": "ERROR_IMAGE_TOO_SMALL",
                      "errorMessage": "ERROR_IMAGE_TOO_SMALL",
                      "processedAt": "2026-05-05T12:00:00Z"
                    }
                  ]
                }
                """);

        assertThat(response.status()).isEqualTo("active");
        assertThat(response.listId()).isEqualTo("9001");
        assertThat(response.imageErrors()).hasSize(1);
        assertThat(response.imageErrors().getFirst().status()).isEqualTo("ERROR_IMAGE_TOO_SMALL");
    }

    @Test
    void parseBalanceHandles410Responses() {
        OlxResponseParser.BalanceResponse response = parser.parseBalance("""
                {
                  "reason": "BALANCE_UNAVAILABLE",
                  "message": "Conta sem plano ativo"
                }
                """, 410);

        assertThat(response.available()).isFalse();
        assertThat(response.reason()).isEqualTo("BALANCE_UNAVAILABLE");
        assertThat(response.message()).isEqualTo("Conta sem plano ativo");
    }
}
