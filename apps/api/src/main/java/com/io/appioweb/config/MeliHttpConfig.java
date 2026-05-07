package com.io.appioweb.config;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@Configuration
public class MeliHttpConfig {

    private static final Logger log = LoggerFactory.getLogger(MeliHttpConfig.class);

    @Bean
    @Qualifier("meliRestClient")
    RestClient meliRestClient(
            MeliProperties properties,
            @Value("${meli.timeout-ms:25000}") long timeoutMs
    ) {
        return RestClient.builder()
                .baseUrl(properties.getApiBaseUrl())
                .requestFactory(requestFactory(timeoutMs))
                .requestInterceptor(new SanitizedLoggingInterceptor())
                .build();
    }

    private SimpleClientHttpRequestFactory requestFactory(long timeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofMillis(Math.max(timeoutMs, 1000L)));
        return factory;
    }

    private static class SanitizedLoggingInterceptor implements ClientHttpRequestInterceptor {
        @Override
        public ClientHttpResponse intercept(
                org.springframework.http.HttpRequest request,
                byte[] body,
                ClientHttpRequestExecution execution
        ) throws IOException {
            URI uri = request.getURI();
            if (log.isDebugEnabled()) {
                log.debug("MELI request method={} uri={} headers={}", request.getMethod(), uri, sanitizeHeaders(request.getHeaders()));
            }
            ClientHttpResponse response = execution.execute(request, body);
            if (log.isDebugEnabled()) {
                log.debug("MELI response method={} uri={} status={}", request.getMethod(), uri, response.getStatusCode().value());
            }
            return response;
        }

        private Map<String, String> sanitizeHeaders(HttpHeaders headers) {
            Map<String, String> sanitized = new LinkedHashMap<>();
            headers.forEach((key, values) -> {
                if ("authorization".equalsIgnoreCase(key) || "x-api-key".equalsIgnoreCase(key)) {
                    sanitized.put(key, "***");
                } else {
                    sanitized.put(key, String.join(",", values));
                }
            });
            return sanitized;
        }
    }
}
