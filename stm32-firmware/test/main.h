#include <stdint.h>
#include <stddef.h>
typedef struct { int x; } USART_TypeDef;
typedef struct { USART_TypeDef *Instance; } UART_HandleTypeDef;
typedef struct { int x; } GPIO_TypeDef;
typedef struct { uint32_t Pin, Mode, Pull, Speed; } GPIO_InitTypeDef;
typedef enum { GPIO_PIN_RESET = 0, GPIO_PIN_SET = 1 } GPIO_PinState;
extern GPIO_TypeDef GPIOB_, GPIOC_;
#define GPIOB (&GPIOB_)
#define GPIOC (&GPIOC_)
#define GPIO_PIN_0 1u
#define GPIO_PIN_1 2u
#define GPIO_PIN_10 0x400u
#define GPIO_PIN_11 0x800u
#define GPIO_PIN_12 0x1000u
#define GPIO_PIN_13 0x2000u
#define GPIO_MODE_OUTPUT_PP 1
#define GPIO_NOPULL 0
#define GPIO_SPEED_FREQ_LOW 0
extern USART_TypeDef U1_, U2_;
#define USART1 (&U1_)
#define USART2 (&U2_)
#define __HAL_RCC_GPIOB_CLK_ENABLE()
#define __HAL_RCC_GPIOC_CLK_ENABLE()
uint32_t HAL_GetTick(void);
void HAL_Delay(uint32_t);
void HAL_GPIO_Init(GPIO_TypeDef*, GPIO_InitTypeDef*);
void HAL_GPIO_WritePin(GPIO_TypeDef*, uint32_t, GPIO_PinState);
int HAL_UART_Transmit(UART_HandleTypeDef*, uint8_t*, uint16_t, uint32_t);
int HAL_UART_Receive_IT(UART_HandleTypeDef*, uint8_t*, uint16_t);
