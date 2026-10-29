#ifndef APP_CONFIG_H
#define APP_CONFIG_H

/* ===== 1. Wi-Fi (ESP8266 on USART2) ===== */
#define WIFI_SSID        "YOUR_WIFI_NAME"
#define WIFI_PASS        "YOUR_WIFI_PASSWORD"

/* ===== 2. Spring Boot server: the PC/server IP that runs the backend (NOT localhost) ===== */
#define SERVER_HOST      "192.168.1.50"
#define SERVER_PORT      8080

/* ===== 3. This reader's identity: create it in Admin > RFID readers, then copy the code + API key here ===== */
#define READER_CODE      "READER-001"
#define API_KEY          "demo-reader-key"

/* ===== 4. Timing (ms) ===== */
#define NORMAL_GREEN_MS  10000u   /* normal cycle: green time per road */
#define YELLOW_MS         2000u
#define RFID_POLL_MS       300u   /* how often the UHF reader is asked for a tag */
#define SAME_TAG_COOLDOWN_MS 3000u
#define PING_MS           30000u  /* heartbeat so the admin sees "online" */
#define WIFI_RETRY_MS     15000u
#define MIN_PREEMPT_S        5    /* safety limits for the green time the server may request */
#define MAX_PREEMPT_S       60

/* ===== 5. Traffic-light outputs (active HIGH). Drive LEDs via 330R, or a relay/optocoupler board for a real controller ===== */
/* Road axis NS (North/South) */
#define NS_R_PORT GPIOB
#define NS_R_PIN  GPIO_PIN_0
#define NS_Y_PORT GPIOB
#define NS_Y_PIN  GPIO_PIN_1
#define NS_G_PORT GPIOB
#define NS_G_PIN  GPIO_PIN_10
/* Road axis EW (East/West) */
#define EW_R_PORT GPIOB
#define EW_R_PIN  GPIO_PIN_11
#define EW_Y_PORT GPIOB
#define EW_Y_PIN  GPIO_PIN_12
#define EW_G_PORT GPIOB
#define EW_G_PIN  GPIO_PIN_13
/* Status LED (Blue Pill on-board LED, active LOW) */
#define ST_PORT   GPIOC
#define ST_PIN    GPIO_PIN_13

#endif
