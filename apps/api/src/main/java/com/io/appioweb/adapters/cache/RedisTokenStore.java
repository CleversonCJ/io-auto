package com.io.appioweb.adapters.cache;

import java.time.Duration;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

public class RedisTokenStore {

    private static final String PREFIX_REFRESH = "auth:refresh:";
    private static final String PREFIX_REFRESH_ROTATION = "auth:refresh-rotation:";
    private static final String PREFIX_BLACKLIST = "auth:blacklist:";
    private static final DefaultRedisScript<String> CONSUME_REFRESH_SCRIPT = new DefaultRedisScript<>(
            "local value = redis.call('GET', KEYS[1]); "
                    + "if value then redis.call('DEL', KEYS[1]); end; "
                    + "return value;",
            String.class
    );

    private final StringRedisTemplate redis;

    public RedisTokenStore(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void storeRefresh(String jti, String payload, Duration ttl) {
        redis.opsForValue().set(PREFIX_REFRESH + jti, payload, ttl);
    }

    public String getRefresh(String jti) {
        return redis.opsForValue().get(PREFIX_REFRESH + jti);
    }

    public String consumeRefresh(String jti) {
        return redis.execute(CONSUME_REFRESH_SCRIPT, List.of(PREFIX_REFRESH + jti));
    }

    public void deleteRefresh(String jti) {
        redis.delete(PREFIX_REFRESH + jti);
    }

    public void storeRefreshRotation(String jti, String accessToken, String refreshToken, long accessExpiresInSeconds, Duration ttl) {
        String value = accessExpiresInSeconds + "|" + accessToken + "|" + refreshToken;
        redis.opsForValue().set(PREFIX_REFRESH_ROTATION + jti, value, ttl);
    }

    public RefreshRotation getRefreshRotation(String jti) {
        String value = redis.opsForValue().get(PREFIX_REFRESH_ROTATION + jti);
        if (value == null || value.isBlank()) return null;

        String[] parts = value.split("\\|", 3);
        if (parts.length != 3) return null;

        try {
            return new RefreshRotation(parts[1], parts[2], Long.parseLong(parts[0]));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    public void deleteRefreshRotation(String jti) {
        redis.delete(PREFIX_REFRESH_ROTATION + jti);
    }

    public void blacklistAccess(String jti, Duration ttl) {
        redis.opsForValue().set(PREFIX_BLACKLIST + jti, "1", ttl);
    }

    public boolean isAccessBlacklisted(String jti) {
        Boolean exists = redis.hasKey(PREFIX_BLACKLIST + jti);
        return Boolean.TRUE.equals(exists);
    }

    public record RefreshRotation(
            String accessToken,
            String refreshToken,
            long accessExpiresInSeconds
    ) {
    }
}
