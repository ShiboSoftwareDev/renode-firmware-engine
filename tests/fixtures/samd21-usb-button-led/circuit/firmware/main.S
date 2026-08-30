.syntax unified
.thumb
.cpu cortex-m0plus
.section .text
.global reset_handler
.type reset_handler, %function

// PA16 is the user switch. PA17 drives LED1.
// Released: blink LED1. Pressed: hold LED1 on.
reset_handler:
  ldr r0, =0x41004408
  ldr r1, =0x00020000
  str r1, [r0]

  ldr r0, =0x41004450
  movs r1, #2
  strb r1, [r0]

blink_on:
  ldr r0, =0x41004418
  ldr r1, =0x00020000
  str r1, [r0]
  bl delay_and_check_button
  cmp r0, #1
  beq blink_on

blink_off:
  ldr r0, =0x41004414
  ldr r1, =0x00020000
  str r1, [r0]
  bl delay_and_check_button
  cmp r0, #1
  beq blink_on
  b blink_on

delay_and_check_button:
  ldr r3, =5000
delay_loop:
  subs r3, r3, #1
  bne delay_loop
  ldr r0, =0x41004420
  ldr r0, [r0]
  lsrs r0, r0, #16
  movs r1, #1
  ands r0, r1
  bx lr

.size reset_handler, .-reset_handler
