package com.io.appioweb.adapters.web.atendimentos.response;

import java.time.Instant;
import java.util.UUID;

public record ConversationEventHttpResponse(
        UUID id,
        String type,
        String text,
        UUID actorUserId,
        String actorUserName,
        Instant at
) {}
