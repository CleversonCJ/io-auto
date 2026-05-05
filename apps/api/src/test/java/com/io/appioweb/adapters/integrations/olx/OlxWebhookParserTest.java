package com.io.appioweb.adapters.integrations.olx;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OlxWebhookParserTest {

    @Test
    void parsesWebhookPayload() {
        OlxWebhookParser parser = new OlxWebhookParser();

        OlxWebhookParser.WebhookPayload payload = parser.parse("""
                {
                  "id": "evt-1",
                  "topic": "AD_STATUS",
                  "created_at": "2026-05-05T15:00:00Z",
                  "data": {
                    "ad": {
                      "id": "car_123",
                      "list_id": "9001",
                      "category": "2020",
                      "status": "active",
                      "operation": "insert",
                      "reason_tag": "REFUSED_SUSPECT_PRICE",
                      "message": "Mensagem"
                    },
                    "actions": {
                      "view": "https://www.olx.com.br/ad/9001"
                    }
                  }
                }
                """);

        assertThat(payload.id()).isEqualTo("evt-1");
        assertThat(payload.localAdId()).isEqualTo("car_123");
        assertThat(payload.listId()).isEqualTo("9001");
        assertThat(payload.status()).isEqualTo("active");
        assertThat(payload.viewUrl()).isEqualTo("https://www.olx.com.br/ad/9001");
    }
}
