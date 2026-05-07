package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliApiClient;
import com.io.appioweb.adapters.integrations.mercadolivre.MeliProperties;
import com.io.appioweb.adapters.persistence.ioauto.MeliCategoryAttributeRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.MeliCategoryRepositoryJpa;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MeliCategoryServiceTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void syncRootCategoriesUsesAuthenticatedClient() throws Exception {
        MeliApiClient apiClient = mock(MeliApiClient.class);
        MeliCategoryRepositoryJpa categories = mock(MeliCategoryRepositoryJpa.class);
        MeliCategoryAttributeRepositoryJpa attributes = mock(MeliCategoryAttributeRepositoryJpa.class);
        MeliProperties properties = new MeliProperties();
        properties.setSiteId("MLB");
        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");

        when(apiClient.get(eq("/sites/MLB/categories"), eq(companyId))).thenReturn(
                new MeliApiClient.JsonResponse(
                        OBJECT_MAPPER.readTree("""
                                [
                                  { "id": "MLB1744", "name": "Carros e Caminhonetes" }
                                ]
                                """),
                        "",
                        200
                )
        );
        when(categories.findBySiteIdAndCategoryId("MLB", "MLB1744")).thenReturn(Optional.empty());

        MeliCategoryService service = new MeliCategoryService(apiClient, properties, categories, attributes);

        MeliCategoryService.CategorySyncSummary summary = service.syncRootCategories(companyId);

        assertThat(summary.total()).isEqualTo(1);
        verify(apiClient).get("/sites/MLB/categories", companyId);
        verify(apiClient, never()).getPublic("/sites/MLB/categories");
        verify(categories).save(any());
    }

    @Test
    void discoverVehicleCategoryKeepsUsingPublicDiscoveryEndpoint() throws Exception {
        MeliApiClient apiClient = mock(MeliApiClient.class);
        MeliCategoryRepositoryJpa categories = mock(MeliCategoryRepositoryJpa.class);
        MeliCategoryAttributeRepositoryJpa attributes = mock(MeliCategoryAttributeRepositoryJpa.class);
        MeliProperties properties = new MeliProperties();
        properties.setSiteId("MLB");

        when(apiClient.getPublic(anyString())).thenReturn(
                new MeliApiClient.JsonResponse(
                        OBJECT_MAPPER.readTree("""
                                [
                                  {
                                    "domain_id": "MLB-CARS_AND_VANS",
                                    "domain_name": "Carros e caminhonetes",
                                    "category_id": "MLB1744",
                                    "category_name": "Carros e Caminhonetes"
                                  }
                                ]
                                """),
                        "",
                        200
                )
        );

        MeliCategoryService service = new MeliCategoryService(apiClient, properties, categories, attributes);

        MeliCategoryService.CategorySuggestion suggestion = service.discoverVehicleCategory("Chevrolet Onix");

        assertThat(suggestion).isNotNull();
        assertThat(suggestion.categoryId()).isEqualTo("MLB1744");
        verify(apiClient).getPublic("/sites/MLB/domain_discovery/search?limit=1&target=classified&q=Chevrolet+Onix");
        verify(apiClient, never()).get(anyString(), any());
    }
}
