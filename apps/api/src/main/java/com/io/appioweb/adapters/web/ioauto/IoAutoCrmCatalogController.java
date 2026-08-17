package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.ioauto.CrmLabelCatalogRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaCrmLabelCatalogEntity;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.shared.errors.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/ioauto/crm")
public class IoAutoCrmCatalogController {

    private static final int MAX_LABELS = 250;

    private final CurrentUserPort currentUser;
    private final CrmLabelCatalogRepositoryJpa labels;

    public IoAutoCrmCatalogController(CurrentUserPort currentUser, CrmLabelCatalogRepositoryJpa labels) {
        this.currentUser = currentUser;
        this.labels = labels;
    }

    @GetMapping("/labels")
    public ResponseEntity<List<LabelResponse>> listLabels() {
        var data = labels.findAllByCompanyIdOrderByTitleAsc(currentUser.companyId()).stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(data);
    }

    @PutMapping("/labels")
    @Transactional
    public ResponseEntity<List<LabelResponse>> replaceLabels(@Valid @RequestBody CatalogItemsRequest<LabelRequest> request) {
        List<LabelRequest> items = request == null || request.items() == null ? List.of() : request.items();
        if (items.size() > MAX_LABELS) {
            throw new BusinessException("CRM_LABEL_CATALOG_LIMIT", "O limite é de " + MAX_LABELS + " etiquetas.");
        }
        assertUniqueItems(items);

        UUID companyId = currentUser.companyId();
        Instant now = Instant.now();
        labels.deleteAllByCompanyId(companyId);
        labels.flush();

        var entities = items.stream().map(item -> {
            JpaCrmLabelCatalogEntity entity = new JpaCrmLabelCatalogEntity();
            entity.setId(UUID.randomUUID());
            entity.setCompanyId(companyId);
            entity.setExternalId(item.id().trim());
            entity.setTitle(item.title().trim());
            entity.setColor(normalizeColor(item.color()));
            entity.setCreatedAt(parseInstant(item.createdAt(), now));
            entity.setUpdatedAt(now);
            return entity;
        }).toList();
        labels.saveAllAndFlush(entities);

        return ResponseEntity.ok(labels.findAllByCompanyIdOrderByTitleAsc(companyId).stream()
                .map(this::toResponse)
                .toList());
    }

    private void assertUniqueItems(List<LabelRequest> items) {
        Set<String> ids = new HashSet<>();
        Set<String> titles = new HashSet<>();
        for (LabelRequest item : items) {
            if (!ids.add(item.id().trim())) {
                throw new BusinessException("CRM_LABEL_DUPLICATE_ID", "Há etiquetas duplicadas na solicitação.");
            }
            if (!titles.add(item.title().trim().toLowerCase(Locale.ROOT))) {
                throw new BusinessException("CRM_LABEL_DUPLICATE_TITLE", "Já existe uma etiqueta com esse título.");
            }
        }
    }

    private LabelResponse toResponse(JpaCrmLabelCatalogEntity entity) {
        return new LabelResponse(
                entity.getExternalId(),
                entity.getTitle(),
                entity.getColor(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private String normalizeColor(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        return normalized.matches("^#[0-9A-F]{6}$") ? normalized : "#64748B";
    }

    private Instant parseInstant(String value, Instant fallback) {
        try {
            return value == null || value.isBlank() ? fallback : Instant.parse(value);
        } catch (Exception ignored) {
            return fallback;
        }
    }

    public record CatalogItemsRequest<T>(@Valid @NotNull List<@Valid T> items) {}

    public record LabelRequest(
            @NotBlank @Size(max = 120) String id,
            @NotBlank @Size(max = 180) String title,
            @NotBlank @Pattern(regexp = "^#?[0-9a-fA-F]{6}$") String color,
            @Size(max = 40) String createdAt
    ) {}

    public record LabelResponse(String id, String title, String color, Instant createdAt, Instant updatedAt) {}
}
