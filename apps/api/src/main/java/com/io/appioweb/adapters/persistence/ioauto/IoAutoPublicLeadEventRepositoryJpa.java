package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface IoAutoPublicLeadEventRepositoryJpa extends JpaRepository<JpaIoAutoPublicLeadEventEntity, UUID> {
    interface PublicLinkEventAggregate {
        String getSourceType();
        String getSourceReference();
        long getTotalInteractions();
        long getContactClicks();
        long getInterestClicks();
        Instant getLastInteractionAt();
    }

    List<JpaIoAutoPublicLeadEventEntity> findAllByCompanyIdOrderByCreatedAtDesc(UUID companyId);

    @Query(value = """
            select upper(coalesce(event.source_type, '')) as "sourceType",
                   upper(coalesce(event.source_reference, '')) as "sourceReference",
                   count(*) as "totalInteractions",
                   count(*) filter (where upper(event.event_type) = 'CONTACT_CLICK') as "contactClicks",
                   count(*) filter (where upper(event.event_type) = 'INTEREST_CLICK') as "interestClicks",
                   max(event.created_at) as "lastInteractionAt"
            from ioauto_public_lead_events event
            where event.company_id = :companyId
            group by upper(coalesce(event.source_type, '')), upper(coalesce(event.source_reference, ''))
            """, nativeQuery = true)
    List<PublicLinkEventAggregate> summarizeForPublicLinks(@Param("companyId") UUID companyId);
}
