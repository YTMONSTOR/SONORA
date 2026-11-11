package com.sonora;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class SonoraApplication {
    public static void main(String[] args) {
        SpringApplication.run(SonoraApplication.class, args);
    }
}
