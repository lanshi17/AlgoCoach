package com.algocoach.config;

import io.netty.channel.ChannelOption;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.web.reactive.function.client.WebClientAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the gateway {@link WebClient.Builder} bean, its timeouts, and that it
 * coexists with (replaces) Spring Boot's auto-configured prototype builder.
 */
class WebClientConfigTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(WebClientAutoConfiguration.class));

    @Test
    void registersSingleBuilderBeanAndBacksOffAutoConfiguration() {
        runner.withUserConfiguration(WebClientConfig.class)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(WebClient.Builder.class);
                    assertThat(context.getBeanFactory().getBeanDefinition("webClientBuilder").isSingleton()).isTrue();
                });
    }

    @Test
    void autoConfigurationStillProvidesBuilderWithoutOurConfig() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(WebClient.Builder.class);
        });
    }

    @Test
    void builderUsesReactorConnectorWithGatewayTimeouts() {
        HttpClient httpClient = WebClientConfig.createHttpClient();

        assertThat(httpClient.configuration().responseTimeout()).isEqualTo(WebClientConfig.RESPONSE_TIMEOUT);
        assertThat(httpClient.configuration().options())
                .containsKey(ChannelOption.CONNECT_TIMEOUT_MILLIS);
        assertThat(httpClient.configuration().options().get(ChannelOption.CONNECT_TIMEOUT_MILLIS))
                .isEqualTo(WebClientConfig.CONNECT_TIMEOUT_MILLIS);

        WebClient.Builder builder = new WebClientConfig().webClientBuilder();
        assertThat(ReflectionTestUtils.getField(builder, "connector")).isInstanceOf(ReactorClientHttpConnector.class);
        assertThat(builder.build()).isNotNull();
    }
}
