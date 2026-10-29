#include "main.h"
#include "app.h"
#include <stdio.h>
GPIO_TypeDef GPIOB_, GPIOC_; USART_TypeDef U1_, U2_;
UART_HandleTypeDef huart1 = { &U1_ }, huart2 = { &U2_ };
static uint32_t now; static uint32_t pins;
uint32_t HAL_GetTick(void) { return now; }
void HAL_Delay(uint32_t m) { now += m; }
void HAL_GPIO_Init(GPIO_TypeDef *p, GPIO_InitTypeDef *g) { (void)p; (void)g; }
void HAL_GPIO_WritePin(GPIO_TypeDef *p, uint32_t pin, GPIO_PinState s) { if (p == GPIOB) { if (s) pins |= pin; else pins &= ~pin; } }
int HAL_UART_Transmit(UART_HandleTypeDef *h, uint8_t *d, uint16_t n, uint32_t t) { (void)h; (void)d; (void)n; (void)t; return 0; }
int HAL_UART_Receive_IT(UART_HandleTypeDef *h, uint8_t *d, uint16_t n) { (void)h; (void)d; (void)n; return 0; }
static const char *show(void) {
  static char s[40]; const char *c[3] = {"R","Y","G"};
  int ns = (pins & 1) ? 0 : (pins & 2) ? 1 : (pins & 0x400) ? 2 : -1;
  int ew = (pins & 0x800) ? 0 : (pins & 0x1000) ? 1 : (pins & 0x2000) ? 2 : -1;
  snprintf(s, sizeof s, "NS=%s EW=%s", ns<0?"?":c[ns], ew<0?"?":c[ew]); return s; }
static void run_to(uint32_t t) { while (now < t) { now += 100; Signal_Task(); } }
int main(void) {
  Signal_Init(); printf("t=0      %s (normal start)\n", show());
  run_to(10100); printf("t=10.1s  %s (NS yellow)\n", show());
  run_to(12300); printf("t=12.3s  %s (EW green)\n", show());
  now = 13000; Signal_Preempt('N', 20);  printf("t=13s    ambulance from N asks 20s -> %s (EW yellow first)\n", show());
  run_to(15200); printf("t=15.2s  %s (NS held green)\n", show());
  run_to(34000); printf("t=34s    %s (still green)\n", show());
  run_to(35500); printf("t=35.5s  %s (hold over -> NS yellow)\n", show());
  run_to(37600); printf("t=37.6s  %s (back to normal cycle)\n", show());
  now = 38000; Signal_Preempt('N', 500); run_to(38100); printf("clamp test: NS already green -> %s\n", show());
  run_to(38000 + 59000); printf("t+59s    %s (MAX 60s respected)\n", show());
  run_to(38000 + 61000); printf("t+61s    %s\n", show());
  return 0; }
