package com.io.appioweb.adapters.web.onboarding;

import com.io.appioweb.adapters.persistence.auth.UserRepositoryJpa;
import com.io.appioweb.application.onboarding.FirstUserOnboardingService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class FirstUserOnboardingControllerTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void rejectsEventExplicitlyForwardedToAnotherApplication() throws Exception {
        FirstUserOnboardingService service = mock(FirstUserOnboardingService.class);
        UserRepositoryJpa users = mock(UserRepositoryJpa.class);
        FirstUserOnboardingController controller = new FirstUserOnboardingController(service, users);

        assertThatThrownBy(() -> controller.handlePaymentEvent(
                "io_connect",
                OBJECT_MAPPER.readTree("{\"event\":\"PAYMENT_CONFIRMED\"}")
        )).isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(service, users);
    }

    @Test
    void rejectsEventWithoutCentralRouterIdentification() throws Exception {
        FirstUserOnboardingService service = mock(FirstUserOnboardingService.class);
        UserRepositoryJpa users = mock(UserRepositoryJpa.class);
        FirstUserOnboardingController controller = new FirstUserOnboardingController(service, users);

        assertThatThrownBy(() -> controller.handlePaymentEvent(
                null,
                OBJECT_MAPPER.readTree("{\"event\":\"PAYMENT_CONFIRMED\"}")
        )).isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(service, users);
    }

    @Test
    void acknowledgesSubscriptionEventWithoutTryingToActivateAccount() throws Exception {
        FirstUserOnboardingService service = mock(FirstUserOnboardingService.class);
        UserRepositoryJpa users = mock(UserRepositoryJpa.class);
        FirstUserOnboardingController controller = new FirstUserOnboardingController(service, users);

        ResponseEntity<Map<String, Object>> response = controller.handlePaymentEvent(
                "io_auto",
                OBJECT_MAPPER.readTree("""
                        {
                          "id": "evt_subscription",
                          "event": "SUBSCRIPTION_CREATED",
                          "subscription": {"id": "sub_123"}
                        }
                        """)
        );

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).containsEntry("ignored", true);
        assertThat(response.getBody()).containsEntry("event", "SUBSCRIPTION_CREATED");
        verifyNoInteractions(service, users);
    }
}
