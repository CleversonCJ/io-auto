package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliApiClient;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MeliProfileServiceTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void getStatusHydratesMissingFullNameFromMercadoLivreProfile() throws Exception {
        MeliApiClient apiClient = mock(MeliApiClient.class);
        MeliAccountService accountService = mock(MeliAccountService.class);
        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");

        when(accountService.getStatus(companyId))
                .thenReturn(new MeliAccountService.MeliConnectionSnapshot(
                        companyId,
                        true,
                        "CONNECTED",
                        123L,
                        null,
                        "loja-teste",
                        "MLB",
                        null,
                        Instant.parse("2026-05-07T17:00:00Z"),
                        Instant.parse("2026-05-07T17:00:00Z"),
                        true
                ))
                .thenReturn(new MeliAccountService.MeliConnectionSnapshot(
                        companyId,
                        true,
                        "CONNECTED",
                        123L,
                        "Loja Teste Silva",
                        "loja-teste",
                        "MLB",
                        "https://http2.mlstatic.com/D_NQ_NP_profile.jpg",
                        Instant.parse("2026-05-07T17:00:00Z"),
                        Instant.parse("2026-05-07T17:05:00Z"),
                        true
                ));
        when(apiClient.get("/users/me", companyId)).thenReturn(
                new MeliApiClient.JsonResponse(
                        OBJECT_MAPPER.readTree("""
                                {
                                  "nickname": "loja-teste",
                                  "first_name": "Loja",
                                  "last_name": "Teste Silva",
                                  "site_id": "MLB",
                                  "logo": "https://http2.mlstatic.com/D_NQ_NP_profile.jpg"
                                }
                                """),
                        "",
                        200
                )
        );

        MeliProfileService service = new MeliProfileService(apiClient, accountService);

        MeliAccountService.MeliConnectionSnapshot status = service.getStatus(companyId);

        assertThat(status.fullName()).isEqualTo("Loja Teste Silva");
        assertThat(status.profileImageUrl()).isEqualTo("https://http2.mlstatic.com/D_NQ_NP_profile.jpg");
        verify(accountService).updateProfile(
                companyId,
                "loja-teste",
                "Loja Teste Silva",
                "MLB",
                "https://http2.mlstatic.com/D_NQ_NP_profile.jpg"
        );
    }

    @Test
    void getStatusSkipsHydrationWhenFullNameAlreadyExists() {
        MeliApiClient apiClient = mock(MeliApiClient.class);
        MeliAccountService accountService = mock(MeliAccountService.class);
        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        MeliAccountService.MeliConnectionSnapshot snapshot = new MeliAccountService.MeliConnectionSnapshot(
                companyId,
                true,
                "CONNECTED",
                123L,
                "Loja Teste Silva",
                "loja-teste",
                "MLB",
                null,
                Instant.parse("2026-05-07T17:00:00Z"),
                Instant.parse("2026-05-07T17:05:00Z"),
                true
        );
        when(accountService.getStatus(companyId)).thenReturn(snapshot);

        MeliProfileService service = new MeliProfileService(apiClient, accountService);

        MeliAccountService.MeliConnectionSnapshot status = service.getStatus(companyId);

        assertThat(status).isSameAs(snapshot);
        verify(apiClient, never()).get("/users/me", companyId);
        verify(accountService, never()).updateProfile(companyId, "loja-teste", "Loja Teste Silva", "MLB", null);
    }
}
