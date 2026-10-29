package com.ambulance.preemption;

import java.util.TimeZone;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PreemptionApplication {
    public static void main(String[] args) {
        // keep JVM, JDBC session and JSON output in one time zone
        TimeZone.setDefault(TimeZone.getTimeZone(System.getenv().getOrDefault("APP_TIMEZONE", "Asia/Kolkata")));
        SpringApplication.run(PreemptionApplication.class, args);
    }
}
