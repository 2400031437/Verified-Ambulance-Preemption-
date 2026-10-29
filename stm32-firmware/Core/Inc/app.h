#ifndef APP_H
#define APP_H
#include <stdint.h>

void App_Init(void);   /* call once in main() after MX_USART1_UART_Init / MX_USART2_UART_Init */
void App_Loop(void);   /* call forever inside while(1) */

/* exposed for testing */
void Signal_Init(void);
void Signal_Task(void);
void Signal_Preempt(char dir, int seconds);
#endif
