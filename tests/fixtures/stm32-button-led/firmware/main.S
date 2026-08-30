.syntax unified
.thumb
.cpu cortex-m4
.section .text
.global reset_handler
.type reset_handler, %function

reset_handler:
  ldr r0, =0x40023830
  ldr r1, [r0]
  orr.w r1, r1, #0x9
  str r1, [r0]

  ldr r0, =0x40020c00
  ldr r1, [r0]
  bic.w r1, r1, #0x03000000
  orr.w r1, r1, #0x01000000
  str r1, [r0]

  ldr r0, =0x4002000c
  ldr r1, [r0]
  bic.w r1, r1, #0x3
  orr.w r1, r1, #0x2
  str r1, [r0]

read_button:
  ldr r0, =0x40020010
  ldr r1, [r0]
  tst r1, #0x1
  ldr r0, =0x40020c14
  ldr r2, [r0]
  ite ne
  orrne.w r2, r2, #0x1000
  biceq.w r2, r2, #0x1000
  str r2, [r0]
  b read_button

.size reset_handler, .-reset_handler
