package com.io.appioweb.application.superadmin;

import com.io.appioweb.adapters.persistence.superadmin.JpaSupportTicketEntity;
import com.io.appioweb.adapters.persistence.superadmin.JpaSupportTicketMessageEntity;
import com.io.appioweb.adapters.persistence.superadmin.SupportTicketMessageRepositoryJpa;
import com.io.appioweb.adapters.persistence.superadmin.SupportTicketRepositoryJpa;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.shared.errors.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupportTicketServiceTest {

    @Mock
    private SupportTicketRepositoryJpa tickets;

    @Mock
    private SupportTicketMessageRepositoryJpa messages;

    @Mock
    private CurrentUserPort currentUser;

    @Mock
    private NamedParameterJdbcTemplate jdbc;

    private SupportTicketService service;
    private UUID companyId;
    private UUID userId;

    @BeforeEach
    void setUp() {
        service = new SupportTicketService(tickets, messages, currentUser, jdbc);
        companyId = UUID.randomUUID();
        userId = UUID.randomUUID();

        when(currentUser.companyId()).thenReturn(companyId);
        when(currentUser.userId()).thenReturn(userId);
        lenient().when(jdbc.queryForObject(eq("select name from companies where id = :id"), any(MapSqlParameterSource.class), eq(String.class)))
                .thenReturn("Revenda Exemplo");
        lenient().when(jdbc.queryForObject(eq("select full_name from users where id = :id"), any(MapSqlParameterSource.class), eq(String.class)))
                .thenReturn("Maria Silva");
    }

    @Test
    void createTicketStoresEvidenceAndAllRequiredFields() {
        SupportTicketService.TicketDetail detail = service.createTicket(new SupportTicketService.CreateTicketCommand(
                "Falha ao publicar estoque",
                "O anuncio nao sobe quando salvo.",
                "BUG",
                null,
                "Publicacoes",
                "erro-publicacao.png",
                "image/png",
                "data:image/png;base64,aGVsbG8=",
                guidedAnswers()
        ));

        ArgumentCaptor<JpaSupportTicketEntity> ticketCaptor = ArgumentCaptor.forClass(JpaSupportTicketEntity.class);
        ArgumentCaptor<JpaSupportTicketMessageEntity> messageCaptor = ArgumentCaptor.forClass(JpaSupportTicketMessageEntity.class);

        verify(tickets).save(ticketCaptor.capture());
        verify(messages).save(messageCaptor.capture());

        assertThat(ticketCaptor.getValue().getBugArea()).isEqualTo("Publicacoes");
        assertThat(ticketCaptor.getValue().getEvidenceFileName()).isEqualTo("erro-publicacao.png");
        assertThat(ticketCaptor.getValue().getEvidenceContentType()).isEqualTo("image/png");
        assertThat(ticketCaptor.getValue().getEvidenceDataUrl()).isEqualTo("data:image/png;base64,aGVsbG8=");
        assertThat(messageCaptor.getValue().getMessage()).contains("Informacoes guiadas:");
        assertThat(detail.evidenceFileName()).isEqualTo("erro-publicacao.png");
        assertThat(detail.evidenceContentType()).isEqualTo("image/png");
        assertThat(detail.evidenceDataUrl()).isEqualTo("data:image/png;base64,aGVsbG8=");
    }

    @Test
    void createTicketRejectsMissingEvidence() {
        assertThatThrownBy(() -> service.createTicket(new SupportTicketService.CreateTicketCommand(
                "Falha ao publicar estoque",
                "O anuncio nao sobe quando salvo.",
                "BUG",
                null,
                "Publicacoes",
                "",
                "",
                "",
                guidedAnswers()
        )))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code()).isEqualTo("SUPPORT_TICKET_EVIDENCE_REQUIRED"));
    }

    @Test
    void createTicketRejectsWhenAnyGuidedAnswerIsMissing() {
        List<SupportTicketService.GuidedAnswer> answers = new ArrayList<>(guidedAnswers());
        answers.set(2, new SupportTicketService.GuidedAnswer(
                "Em qual tela ou funcionalidade aconteceu?",
                "   "
        ));

        assertThatThrownBy(() -> service.createTicket(new SupportTicketService.CreateTicketCommand(
                "Falha ao publicar estoque",
                "O anuncio nao sobe quando salvo.",
                "BUG",
                null,
                "Publicacoes",
                "erro-publicacao.png",
                "image/png",
                "data:image/png;base64,aGVsbG8=",
                answers
        )))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code()).isEqualTo("SUPPORT_TICKET_GUIDED_ANSWERS_REQUIRED"));
    }

    private List<SupportTicketService.GuidedAnswer> guidedAnswers() {
        return List.of(
                new SupportTicketService.GuidedAnswer("O problema impede voce de usar o sistema?", "Sim, bloqueia as publicacoes."),
                new SupportTicketService.GuidedAnswer("Isso acontece sempre ou as vezes?", "Acontece sempre."),
                new SupportTicketService.GuidedAnswer("Em qual tela ou funcionalidade aconteceu?", "Tela de publicacoes."),
                new SupportTicketService.GuidedAnswer("Houve alguma mensagem de erro?", "Retorna erro 500."),
                new SupportTicketService.GuidedAnswer("Voce ja tentou atualizar a pagina ou sair e entrar novamente?", "Sim, sem sucesso."),
                new SupportTicketService.GuidedAnswer("Quantos usuarios ou atendimentos estao impactados?", "Tres usuarios.")
        );
    }
}
