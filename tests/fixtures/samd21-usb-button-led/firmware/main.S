.syntax unified
.thumb
.cpu cortex-m0plus
.section .text
.global reset_handler
.type reset_handler, %function

reset_handler:
  ldr r0, =0x41004408
  ldr r1, =0x00020000
  str r1, [r0]

  ldr r0, =0x41004450
  movs r1, #2
  strb r1, [r0]

read_button:
  ldr r0, =0x41004420
  ldr r1, [r0]
  ldr r2, =0x00010000
  tst r1, r2
  beq led_off

led_on:
  ldr r0, =0x41004418
  ldr r1, =0x00020000
  str r1, [r0]
  b read_button

led_off:
  ldr r0, =0x41004414
  ldr r1, =0x00020000
  str r1, [r0]
  b read_button

.size reset_handler, .-reset_handler
