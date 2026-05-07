package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliApiClient;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliAccountEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class MeliListingTypeService {

    private final MeliApiClient apiClient;
    private final MeliAccountService accountService;

    public MeliListingTypeService(MeliApiClient apiClient, MeliAccountService accountService) {
        this.apiClient = apiClient;
        this.accountService = accountService;
    }

    @Transactional(readOnly = true)
    public List<ListingTypeSnapshot> getAvailableListingTypes(UUID companyId, String categoryId) {
        String normalizedCategoryId = safe(categoryId);
        if (normalizedCategoryId.isBlank()) {
            throw new BusinessException("MELI_CATEGORY_REQUIRED", "Selecione uma categoria do Mercado Livre.");
        }
        JpaMeliAccountEntity account = accountService.requireActiveAccount(companyId);
        JsonNode root = apiClient.get("/users/" + account.getMeliUserId() + "/available_listing_types?category_id="
                + java.net.URLEncoder.encode(normalizedCategoryId, java.nio.charset.StandardCharsets.UTF_8), companyId).body();
        List<ListingTypeSnapshot> items = new ArrayList<>();
        for (JsonNode item : root.path("available")) {
            items.add(new ListingTypeSnapshot(
                    text(item, "id"),
                    text(item, "name"),
                    text(item, "site_id"),
                    item.path("remaining_listings").isMissingNode() || item.path("remaining_listings").isNull() ? null : item.path("remaining_listings").asInt()
            ));
        }
        return items;
    }

    public List<ListingPriceSnapshot> getListingPrices(String categoryId, BigDecimal price) {
        String normalizedCategoryId = safe(categoryId);
        if (normalizedCategoryId.isBlank()) {
            throw new BusinessException("MELI_CATEGORY_REQUIRED", "Selecione uma categoria do Mercado Livre.");
        }
        if (price == null || price.signum() <= 0) {
            throw new BusinessException("MELI_PRICE_REQUIRED", "Informe um preco valido para consultar os tipos de anuncio.");
        }
        JsonNode root = apiClient.getPublic("/sites/MLB/listing_prices?price="
                + price.toPlainString()
                + "&category_id="
                + java.net.URLEncoder.encode(normalizedCategoryId, java.nio.charset.StandardCharsets.UTF_8)).body();
        List<ListingPriceSnapshot> items = new ArrayList<>();
        if (root.isArray()) {
            for (JsonNode item : root) {
                items.add(new ListingPriceSnapshot(
                        text(item, "listing_type_id"),
                        item.path("sale_fee_amount").decimalValue(),
                        item.path("listing_fee_amount").decimalValue(),
                        text(item, "currency_id")
                ));
            }
        }
        return items;
    }

    private String text(JsonNode root, String field) {
        JsonNode node = root.path(field);
        return node.isMissingNode() || node.isNull() ? "" : safe(node.asText(""));
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record ListingTypeSnapshot(
            String id,
            String name,
            String siteId,
            Integer remainingListings
    ) {
    }

    public record ListingPriceSnapshot(
            String listingTypeId,
            BigDecimal saleFeeAmount,
            BigDecimal listingFeeAmount,
            String currencyId
    ) {
    }
}
