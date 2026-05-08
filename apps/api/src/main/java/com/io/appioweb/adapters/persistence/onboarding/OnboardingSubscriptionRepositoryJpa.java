package com.io.appioweb.adapters.persistence.onboarding;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface OnboardingSubscriptionRepositoryJpa extends JpaRepository<JpaOnboardingSubscriptionEntity, UUID> {

    Optional<JpaOnboardingSubscriptionEntity> findByAsaasSubscriptionId(String asaasSubscriptionId);

    Optional<JpaOnboardingSubscriptionEntity> findByAsaasPaymentId(String asaasPaymentId);

    Optional<JpaOnboardingSubscriptionEntity> findByCompanyId(UUID companyId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM JpaOnboardingSubscriptionEntity s WHERE s.asaasSubscriptionId = :subId")
    Optional<JpaOnboardingSubscriptionEntity> findByAsaasSubscriptionIdForUpdate(@Param("subId") String subId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM JpaOnboardingSubscriptionEntity s WHERE s.asaasPaymentId = :payId")
    Optional<JpaOnboardingSubscriptionEntity> findByAsaasPaymentIdForUpdate(@Param("payId") String payId);
}
