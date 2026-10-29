# STM32 reader + signal controller

```
 UHF RFID reader --USART1--> STM32 --USART2--> ESP8266 --Wi-Fi--> Spring Boot (/api/reader/scan-lite)
                               |
                               +--> 6 GPIO pins --> NS / EW traffic lights (LEDs or relay board)
```
Tested here: `app.c` compiles with `-Wall -Wextra` and the signal state machine was run on a PC with a fake HAL
(`test/test.c`: normal cycle, yellow before switching, hold green, return to normal, 5-60 s clamp).
The UART/ESP8266/RFID parts need real hardware and could not be run in my sandbox, so test them step by step (below).

## Parts
- STM32F103C8 "Blue Pill" (any STM32 with 2 UARTs works)
- UHF RFID reader module + antenna and UHF tags on ambulances (R200 / YRM100 style, UART). Needed for "metres before the signal". 125 kHz RDM6300 reads only a few cm.
- ESP8266 (ESP-01 or NodeMCU) with the standard **AT firmware**
- 6 LEDs + 330 ohm resistors (demo junction). For a real signal use a relay/opto board and the controller's certified preemption input.

## Wiring (3.3 V logic on STM32 pins)
| From | To STM32 |
|---|---|
| RFID reader TX | PA10 (USART1_RX) |
| RFID reader RX | PA9 (USART1_TX) |
| ESP8266 TX | PA3 (USART2_RX) |
| ESP8266 RX | PA2 (USART2_TX) |
| ESP8266 VCC + EN/CH_PD | 3.3 V (use a proper 3.3 V supply, >= 300 mA; not the STM32 pin) |
| NS red / yellow / green LED | PB0 / PB1 / PB10 |
| EW red / yellow / green LED | PB11 / PB12 / PB13 |
| Status LED | PC13 (on-board) |
All grounds common. Check your reader's supply voltage and logic level in its datasheet.

## Add to your project (STM32CubeIDE)
1. New project for your chip. In CubeMX enable **USART1** and **USART2**: Asynchronous, 115200, 8N1 (set USART1 to your reader's baud rate), and turn on the **global interrupt** for both (NVIC). Leave the PB pins alone: the code configures them.
2. Copy `Core/Inc/app.h`, `Core/Inc/app_config.h`, `Core/Src/app.c` into the same folders of your project.
3. In `main.c`:
```c
/* USER CODE BEGIN Includes */
#include "app.h"
/* USER CODE END Includes */
...
/* USER CODE BEGIN 2 */
App_Init();
/* USER CODE END 2 */
while (1) {
  /* USER CODE BEGIN 3 */
  App_Loop();
}
```
4. Edit `app_config.h`: Wi-Fi name/password, **SERVER_HOST = IP of the PC running Spring Boot** (not localhost), READER_CODE and API_KEY (create the reader in Admin > RFID readers and copy its key).

## How it is linked to the software
| Step | Hardware | Software |
|---|---|---|
| Driver presses Save | - | tag status becomes ACTIVE in MySQL |
| Ambulance reaches the reader | STM32 reads tag EPC and calls `GET /api/reader/scan-lite?...` | Spring Boot checks DB, logs a scan |
| Reply `GREEN,25,N,SIG-01` | STM32 gives green on road N for 25 s (yellow first), then resumes the normal cycle | Admin sees the scan live; hospital and driver get a "signal cleared" message |
| Reply `NONE,...` | nothing changes | scan logged as IGNORED / UNKNOWN |
| Every 30 s | STM32 calls `/api/reader/ping` | Admin > RFID readers shows the reader online |
The direction (N/S/E/W) and green seconds come from the reader settings in the admin dashboard, so you change them without re-flashing.

## Test in this order
1. Server only: open `http://SERVER_IP:8080/api/reader/scan-lite?reader_code=READER-001&api_key=demo-reader-key&tag_uid=E2000017221101441890` in a browser -> `NONE,0,N,SIG-01` (or `GREEN,...` after a driver activated that tag).
2. ESP8266 alone with a USB-serial adapter: `AT` -> OK, `AT+CWJAP="ssid","pass"`.
3. STM32 + LEDs only (comment out the RFID/Wi-Fi calls): normal cycle runs.
4. Add the RFID reader: scan a tag, watch the Admin > Scan log.
5. Everything together.
The RFID frame parser follows the common R200/YRM100 format (`BB 02 22 ...`). If your module differs, edit `RFID_POLL_CMD` and `rfid_poll()` in `app.c`.

## Safety
If Wi-Fi/server fail, lights keep their normal cycle. Green time is clamped to 5-60 s. The opposing road always gets yellow first. A real junction must be switched only through a certified traffic-controller preemption input with its own conflict monitor, never from this board directly.
