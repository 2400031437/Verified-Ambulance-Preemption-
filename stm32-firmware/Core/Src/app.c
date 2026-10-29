/*
 * Verified Ambulance Preemption: STM32 reader + traffic-signal controller
 *
 *   UHF RFID reader --USART1--> STM32 --USART2--> ESP8266 --Wi-Fi--> Spring Boot server
 *
 * 1. STM32 polls the UHF reader, gets the tag EPC (hex).
 * 2. It asks the server:  GET /api/reader/scan-lite?reader_code=..&api_key=..&tag_uid=..
 * 3. Server checks the database. Reply "GREEN,25,N,SIG-01" means: tag is ACTIVE -> give green on
 *    approach N for 25 s.  "NONE,..." means: ignore (tag NORMAL / unknown).
 * 4. The signal state machine switches to green for that road, holds it, then returns to the normal cycle.
 * If Wi-Fi or the server is down, the signal simply keeps running its normal cycle (fail-safe).
 */
#include "main.h"
#include "app.h"
#include "app_config.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

extern UART_HandleTypeDef huart1;   /* RFID reader  */
extern UART_HandleTypeDef huart2;   /* ESP8266      */

/* ------------------------------------------------------------------ */
/* UART receive ring buffers (interrupt driven, so no bytes are lost)  */
/* ------------------------------------------------------------------ */
#define RB_SIZE 512u
typedef struct { volatile uint16_t h, t; uint8_t d[RB_SIZE]; } rb_t;
static rb_t rb_rfid, rb_esp;
static uint8_t rx1, rx2;

static void rb_put(rb_t *r, uint8_t b) { uint16_t n = (uint16_t)((r->h + 1u) % RB_SIZE); if (n != r->t) { r->d[r->h] = b; r->h = n; } }
static int  rb_get(rb_t *r, uint8_t *b) { if (r->h == r->t) return 0; *b = r->d[r->t]; r->t = (uint16_t)((r->t + 1u) % RB_SIZE); return 1; }
static void rb_clear(rb_t *r) { r->t = r->h; }

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *h)
{
    if (h->Instance == USART1)      { rb_put(&rb_rfid, rx1); HAL_UART_Receive_IT(&huart1, &rx1, 1); }
    else if (h->Instance == USART2) { rb_put(&rb_esp,  rx2); HAL_UART_Receive_IT(&huart2, &rx2, 1); }
}

/* ------------------------------------------------------------------ */
/* Traffic signal state machine                                        */
/* ------------------------------------------------------------------ */
typedef enum { PH_NS_G, PH_NS_Y, PH_EW_G, PH_EW_Y, PH_PRE_NS, PH_PRE_EW } phase_t;
typedef enum { L_RED, L_YEL, L_GRN } light_t;
enum { AX_NONE = 0, AX_NS = 1, AX_EW = 2 };

static phase_t  phase;
static uint32_t phase_end;
static int      pending_axis, pending_secs;

static void set_axis(int axis, light_t s)
{
    GPIO_PinState r = (s == L_RED) ? GPIO_PIN_SET : GPIO_PIN_RESET;
    GPIO_PinState y = (s == L_YEL) ? GPIO_PIN_SET : GPIO_PIN_RESET;
    GPIO_PinState g = (s == L_GRN) ? GPIO_PIN_SET : GPIO_PIN_RESET;
    if (axis == AX_NS) { HAL_GPIO_WritePin(NS_R_PORT, NS_R_PIN, r); HAL_GPIO_WritePin(NS_Y_PORT, NS_Y_PIN, y); HAL_GPIO_WritePin(NS_G_PORT, NS_G_PIN, g); }
    else               { HAL_GPIO_WritePin(EW_R_PORT, EW_R_PIN, r); HAL_GPIO_WritePin(EW_Y_PORT, EW_Y_PIN, y); HAL_GPIO_WritePin(EW_G_PORT, EW_G_PIN, g); }
}

static void enter(phase_t p, uint32_t ms)
{
    phase = p; phase_end = HAL_GetTick() + ms;
    switch (p) {
    case PH_NS_G: case PH_PRE_NS: set_axis(AX_NS, L_GRN); set_axis(AX_EW, L_RED); break;
    case PH_NS_Y:                 set_axis(AX_NS, L_YEL); set_axis(AX_EW, L_RED); break;
    case PH_EW_G: case PH_PRE_EW: set_axis(AX_EW, L_GRN); set_axis(AX_NS, L_RED); break;
    case PH_EW_Y:                 set_axis(AX_EW, L_YEL); set_axis(AX_NS, L_RED); break;
    }
}

void Signal_Init(void)
{
    pending_axis = AX_NONE; pending_secs = 0;
    enter(PH_NS_G, NORMAL_GREEN_MS);
}

static int axis_of(char dir) { return (dir == 'N' || dir == 'S') ? AX_NS : (dir == 'E' || dir == 'W') ? AX_EW : AX_NONE; }

/* Ask for green on the road the ambulance is coming from, for `seconds`. Safe: always goes through yellow. */
void Signal_Preempt(char dir, int seconds)
{
    int ax = axis_of(dir);
    if (ax == AX_NONE) return;
    if (seconds < MIN_PREEMPT_S) seconds = MIN_PREEMPT_S;
    if (seconds > MAX_PREEMPT_S) seconds = MAX_PREEMPT_S;

    if ((ax == AX_NS && (phase == PH_NS_G || phase == PH_PRE_NS)) ||
        (ax == AX_EW && (phase == PH_EW_G || phase == PH_PRE_EW))) {
        enter(ax == AX_NS ? PH_PRE_NS : PH_PRE_EW, (uint32_t)seconds * 1000u);   /* already green: just hold / extend */
        pending_axis = AX_NONE;
    } else if (phase == PH_NS_Y || phase == PH_EW_Y) {
        pending_axis = ax; pending_secs = seconds;                               /* yellow already running: apply afterwards */
    } else {                                                                      /* the other road is green: yellow first */
        enter(phase == PH_EW_G || phase == PH_PRE_EW ? PH_EW_Y : PH_NS_Y, YELLOW_MS);
        pending_axis = ax; pending_secs = seconds;
    }
}

void Signal_Task(void)
{
    if ((int32_t)(HAL_GetTick() - phase_end) < 0) return;
    switch (phase) {
    case PH_NS_G:   enter(PH_NS_Y, YELLOW_MS); break;
    case PH_PRE_NS: enter(PH_NS_Y, YELLOW_MS); break;
    case PH_EW_G:   enter(PH_EW_Y, YELLOW_MS); break;
    case PH_PRE_EW: enter(PH_EW_Y, YELLOW_MS); break;
    case PH_NS_Y: case PH_EW_Y:
        if (pending_axis != AX_NONE) {
            enter(pending_axis == AX_NS ? PH_PRE_NS : PH_PRE_EW, (uint32_t)pending_secs * 1000u);
            pending_axis = AX_NONE;
        } else {
            enter(phase == PH_NS_Y ? PH_EW_G : PH_NS_G, NORMAL_GREEN_MS);
        }
        break;
    }
}

/* ------------------------------------------------------------------ */
/* UHF RFID reader (R200 / YRM100 style frames). Adjust to your module's datasheet. */
/* Single poll command: BB 00 22 00 00 22 7E                              */
/* Tag reply: BB 02 22 PL_H PL_L RSSI PC(2) EPC(n) CRC(2) CHK 7E          */
/* ------------------------------------------------------------------ */
static const uint8_t RFID_POLL_CMD[7] = { 0xBB, 0x00, 0x22, 0x00, 0x00, 0x22, 0x7E };

static int rfid_poll(char *epc, size_t epc_sz)
{
    uint8_t buf[64]; int n = 0; uint8_t b;
    rb_clear(&rb_rfid);
    HAL_UART_Transmit(&huart1, (uint8_t *)RFID_POLL_CMD, sizeof RFID_POLL_CMD, 50);
    uint32_t t0 = HAL_GetTick();
    while (HAL_GetTick() - t0 < 80u && n < (int)sizeof buf) {
        Signal_Task();
        if (!rb_get(&rb_rfid, &b)) continue;
        if (n == 0 && b != 0xBB) continue;                 /* wait for header */
        buf[n++] = b;
        if (n >= 5) { int total = 5 + ((buf[3] << 8) | buf[4]) + 2; if (n >= total) break; }
    }
    if (n < 8 || buf[1] != 0x02 || buf[2] != 0x22) return 0;      /* no tag (error frame) */
    int pl = (buf[3] << 8) | buf[4];
    int epc_len = pl - 5;                                          /* PL = RSSI(1)+PC(2)+EPC+CRC(2) */
    if (epc_len <= 0 || epc_len > 16 || (size_t)(epc_len * 2 + 1) > epc_sz || 8 + epc_len > n) return 0;
    for (int i = 0; i < epc_len; i++) snprintf(epc + i * 2, 3, "%02X", buf[8 + i]);
    return 1;
}

/* ------------------------------------------------------------------ */
/* ESP8266 (AT firmware) helpers                                       */
/* ------------------------------------------------------------------ */
#define RX_MAX 768
static char rxbuf[RX_MAX]; static int rxlen;
static int wifi_ok;

static void esp_send(const char *s) { HAL_UART_Transmit(&huart2, (uint8_t *)s, (uint16_t)strlen(s), 200); }

static int esp_wait(const char *expect, uint32_t timeout_ms)
{
    uint32_t t0 = HAL_GetTick(); uint8_t c;
    while (HAL_GetTick() - t0 < timeout_ms) {
        Signal_Task();                                   /* keep the traffic lights running while we wait */
        while (rb_get(&rb_esp, &c)) { if (rxlen < RX_MAX - 1) { rxbuf[rxlen++] = (char)c; rxbuf[rxlen] = 0; } }
        if (strstr(rxbuf, expect)) return 1;
    }
    return 0;
}

static int esp_cmd(const char *cmd, const char *expect, uint32_t timeout_ms)
{
    rb_clear(&rb_esp); rxlen = 0; rxbuf[0] = 0;
    esp_send(cmd); esp_send("\r\n");
    return esp_wait(expect, timeout_ms);
}

static void esp_init(void)
{
    char cmd[128];
    wifi_ok = 0;
    if (!esp_cmd("AT", "OK", 1000)) return;
    esp_cmd("ATE0", "OK", 500);
    esp_cmd("AT+CWMODE=1", "OK", 1000);
    snprintf(cmd, sizeof cmd, "AT+CWJAP=\"%s\",\"%s\"", WIFI_SSID, WIFI_PASS);
    if (!esp_cmd(cmd, "OK", 15000)) return;
    esp_cmd("AT+CIPMUX=0", "OK", 1000);
    wifi_ok = 1;
}

/* HTTP/1.0 GET over a raw TCP connection. Response text is left in rxbuf. */
static int http_get(const char *path)
{
    char cmd[96], req[320];
    snprintf(cmd, sizeof cmd, "AT+CIPSTART=\"TCP\",\"%s\",%d", SERVER_HOST, SERVER_PORT);
    if (!esp_cmd(cmd, "OK", 4000)) { esp_cmd("AT+CIPCLOSE", "OK", 500); return 0; }
    int n = snprintf(req, sizeof req, "GET %s HTTP/1.0\r\nHost: %s\r\nConnection: close\r\n\r\n", path, SERVER_HOST);
    snprintf(cmd, sizeof cmd, "AT+CIPSEND=%d", n);
    if (!esp_cmd(cmd, ">", 2000)) { esp_cmd("AT+CIPCLOSE", "OK", 500); return 0; }
    esp_send(req);
    esp_wait("CLOSED", 4000);       /* server closes the connection after the reply */
    return 1;
}

/* ------------------------------------------------------------------ */
/* Application                                                         */
/* ------------------------------------------------------------------ */
static char last_epc[40]; static uint32_t last_epc_t, last_poll, last_ping, next_wifi_try;

static void handle_tag(const char *epc)
{
    char path[200];
    snprintf(path, sizeof path, "/api/reader/scan-lite?reader_code=%s&api_key=%s&tag_uid=%s", READER_CODE, API_KEY, epc);
    if (!http_get(path)) { wifi_ok = 0; return; }              /* network problem: re-init Wi-Fi, lights stay normal */
    char *p = strstr(rxbuf, "GREEN,");
    if (p) {
        int secs = atoi(p + 6);
        char *comma = strchr(p + 6, ',');
        char dir = comma ? comma[1] : 'N';
        Signal_Preempt(dir, secs);
        HAL_GPIO_WritePin(ST_PORT, ST_PIN, GPIO_PIN_RESET);   /* status LED on while preempting */
    }
}

static void gpio_init(void)
{
    GPIO_InitTypeDef g = {0};
    __HAL_RCC_GPIOB_CLK_ENABLE(); __HAL_RCC_GPIOC_CLK_ENABLE();
    g.Mode = GPIO_MODE_OUTPUT_PP; g.Pull = GPIO_NOPULL; g.Speed = GPIO_SPEED_FREQ_LOW;
    g.Pin = NS_R_PIN | NS_Y_PIN | NS_G_PIN | EW_R_PIN | EW_Y_PIN | EW_G_PIN; HAL_GPIO_Init(GPIOB, &g);
    g.Pin = ST_PIN; HAL_GPIO_Init(ST_PORT, &g);
    HAL_GPIO_WritePin(ST_PORT, ST_PIN, GPIO_PIN_SET);
}

void App_Init(void)
{
    gpio_init();
    Signal_Init();
    HAL_UART_Receive_IT(&huart1, &rx1, 1);
    HAL_UART_Receive_IT(&huart2, &rx2, 1);
    HAL_Delay(1500);                       /* let the ESP8266 boot */
    esp_init();
    next_wifi_try = HAL_GetTick() + WIFI_RETRY_MS;
}

void App_Loop(void)
{
    uint32_t now = HAL_GetTick();
    Signal_Task();

    if (phase != PH_PRE_NS && phase != PH_PRE_EW) HAL_GPIO_WritePin(ST_PORT, ST_PIN, GPIO_PIN_SET);   /* status LED off */

    if (!wifi_ok && (int32_t)(now - next_wifi_try) >= 0) { esp_init(); next_wifi_try = HAL_GetTick() + WIFI_RETRY_MS; }

    if (now - last_poll >= RFID_POLL_MS) {
        last_poll = now;
        char epc[40];
        if (rfid_poll(epc, sizeof epc) && wifi_ok) {
            if (strcmp(epc, last_epc) != 0 || now - last_epc_t > SAME_TAG_COOLDOWN_MS) {
                strcpy(last_epc, epc); last_epc_t = now;
                handle_tag(epc);
            }
        }
    }

    if (wifi_ok && now - last_ping >= PING_MS) {
        last_ping = now;
        char path[120];
        snprintf(path, sizeof path, "/api/reader/ping?reader_code=%s&api_key=%s", READER_CODE, API_KEY);
        if (!http_get(path)) wifi_ok = 0;
    }
}
