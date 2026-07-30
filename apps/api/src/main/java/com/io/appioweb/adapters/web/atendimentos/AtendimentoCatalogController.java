package com.io.appioweb.adapters.web.atendimentos;

import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoClassificationCatalogRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoLabelCatalogRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoClassificationCatalogEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoLabelCatalogEntity;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/atendimentos")
public class AtendimentoCatalogController {

    private static final int MAX_CATALOG_ITEMS = 250;
    private static final Set<String> CLASSIFICATION_CATEGORIES = Set.of("achieved", "lost", "questions", "other");

    private final CurrentUserPort currentUser;
    private final AtendimentoLabelCatalogRepositoryJpa labels;
    private final AtendimentoClassificationCatalogRepositoryJpa classifications;

    public AtendimentoCatalogController(
            CurrentUserPort currentUser,
            AtendimentoLabelCatalogRepositoryJpa labels,
            AtendimentoClassificationCatalogRepositoryJpa classifications
    ) {
        this.currentUser = currentUser;
        this.labels = labels;
        this.classifications = classifications;
    }

    @GetMapping("/labels")
    public ResponseEntity<List<LabelResponse>> listLabels() {
        var data = labels.findAllByCompanyIdOrderByTitleAsc(currentUser.companyId()).stream()
                .map(this::toLabelResponse)
                .toList();
        return ResponseEntity.ok(data);
    }

    @PutMapping("/labels")
    @Transactional
    public ResponseEntity<List<LabelResponse>> replaceLabels(@Valid @RequestBody CatalogItemsRequest<LabelRequest> request) {
        List<LabelRequest> items = safeItems(request);
        assertCatalogSize(items.size(), "etiquetas");
        assertUniqueLabelItems(items);

        UUID companyId = currentUser.companyId();
        Instant now = Instant.now();
        labels.deleteAllByCompanyId(companyId);
        labels.flush();

        var entities = items.stream().map(item -> {
            JpaAtendimentoLabelCatalogEntity entity = new JpaAtendimentoLabelCatalogEntity();
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
                .map(this::toLabelResponse)
                .toList());
    }

    @GetMapping("/classifications")
    public ResponseEntity<List<ClassificationResponse>> listClassifications() {
        var data = classifications.findAllByCompanyIdOrderByTitleAsc(currentUser.companyId()).stream()
                .map(this::toClassificationResponse)
                .toList();
        return ResponseEntity.ok(data);
    }

    @PutMapping("/classifications")
    @Transactional
    public ResponseEntity<List<ClassificationResponse>> replaceClassifications(
            @Valid @RequestBody CatalogItemsRequest<ClassificationRequest> request
    ) {
        List<ClassificationRequest> items = safeItems(request);
        assertCatalogSize(items.size(), "classificações");
        assertUniqueClassificationItems(items);

        UUID companyId = currentUser.companyId();
        Instant now = Instant.now();
        classifications.deleteAllByCompanyId(companyId);
        classifications.flush();

        var entities = items.stream().map(item -> {
            String categoryId = item.categoryId().trim().toLowerCase(Locale.ROOT);
            if (!CLASSIFICATION_CATEGORIES.contains(categoryId)) {
                throw new BusinessException("ATENDIMENTO_CLASSIFICATION_CATEGORY_INVALID", "Categoria de classificação inválida.");
            }
            JpaAtendimentoClassificationCatalogEntity entity = new JpaAtendimentoClassificationCatalogEntity();
            entity.setId(UUID.randomUUID());
            entity.setCompanyId(companyId);
            entity.setExternalId(item.id().trim());
            entity.setTitle(item.title().trim());
            entity.setCategoryId(categoryId);
            entity.setHasValue(item.hasValue());
            entity.setValue(item.hasValue() ? item.value() : null);
            entity.setCreatedAt(parseInstant(item.createdAt(), now));
            entity.setUpdatedAt(now);
            return entity;
        }).toList();
        classifications.saveAllAndFlush(entities);

        return ResponseEntity.ok(classifications.findAllByCompanyIdOrderByTitleAsc(companyId).stream()
                .map(this::toClassificationResponse)
                .toList());
    }

    private void assertUniqueLabelItems(List<LabelRequest> items) {
        Set<String> ids = new HashSet<>();
        Set<String> titles = new HashSet<>();
        for (LabelRequest item : items) {
            if (!ids.add(item.id().trim())) {
                throw new BusinessException("ATENDIMENTO_LABEL_DUPLICATE_ID", "Há etiquetas duplicadas na solicitação.");
            }
            if (!titles.add(item.title().trim().toLowerCase(Locale.ROOT))) {
                throw new BusinessException("ATENDIMENTO_LABEL_DUPLICATE_TITLE", "Já existe uma etiqueta com esse título.");
            }
        }
    }

    private void assertUniqueClassificationItems(List<ClassificationRequest> items) {
        Set<String> ids = new HashSet<>();
        Set<String> titles = new HashSet<>();
        for (ClassificationRequest item : items) {
            if (!ids.add(item.id().trim())) {
                throw new BusinessException("ATENDIMENTO_CLASSIFICATION_DUPLICATE_ID", "Há classificações duplicadas na solicitação.");
            }
            String titleKey = item.categoryId().trim().toLowerCase(Locale.ROOT)
                    + "|"
                    + item.title().trim().toLowerCase(Locale.ROOT);
            if (!titles.add(titleKey)) {
                throw new BusinessException(
                        "ATENDIMENTO_CLASSIFICATION_DUPLICATE_TITLE",
                        "Já existe uma classificação com esse título na categoria."
                );
            }
        }
    }

    private void assertCatalogSize(int size, String label) {
        if (size > MAX_CATALOG_ITEMS) {
            throw new BusinessException("ATENDIMENTO_CATALOG_LIMIT", "O limite é de " + MAX_CATALOG_ITEMS + " " + label + ".");
        }
    }

    private LabelResponse toLabelResponse(JpaAtendimentoLabelCatalogEntity entity) {
        return new LabelResponse(
                entity.getExternalId(),
                entity.getTitle(),
                entity.getColor(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private ClassificationResponse toClassificationResponse(JpaAtendimentoClassificationCatalogEntity entity) {
        return new ClassificationResponse(
                entity.getExternalId(),
                entity.getTitle(),
                entity.getCategoryId(),
                entity.isHasValue(),
                entity.getValue(),
                false,
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

    private <T> List<T> safeItems(CatalogItemsRequest<T> request) {
        return request == null || request.items() == null ? List.of() : request.items();
    }

    public record CatalogItemsRequest<T>(@Valid @NotNull List<@Valid T> items) {}

    public record LabelRequest(
            @NotBlank @Size(max = 120) String id,
            @NotBlank @Size(max = 180) String title,
            @NotBlank @Pattern(regexp = "^#?[0-9a-fA-F]{6}$") String color,
            @Size(max = 40) String createdAt
    ) {}

    public record LabelResponse(String id, String title, String color, Instant createdAt, Instant updatedAt) {}

    public record ClassificationRequest(
            @NotBlank @Size(max = 120) String id,
            @NotBlank @Size(max = 180) String title,
            @NotBlank @Size(max = 30) String categoryId,
            boolean hasValue,
            BigDecimal value,
            @Size(max = 40) String createdAt
    ) {}

    public record ClassificationResponse(
            String id,
            String title,
            String categoryId,
            boolean hasValue,
            BigDecimal value,
            boolean system,
            Instant createdAt,
            Instant updatedAt
    ) {}
}
