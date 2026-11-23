@ GBA startup: cartridge header (logo/checksum patched by gbafix), mode setup, .data copy, .bss clear.
    .section .text.start, "ax"
    .arm
    .global _start
_start:
    b       1f
    .space  0x9C            @ logo (156 bytes) — filled in by gbafix
    .ascii  "SPRINGHOURS\0"  @ game title (12 bytes)
    .ascii  "OSHA"           @ game code
    .ascii  "CM"             @ maker
    .space  0xC0-0xB2        @ fixed value / version / checksum (gbafix)
1:
    mov     r0, #0x12        @ IRQ mode
    msr     cpsr_c, r0
    ldr     sp, =0x03007FA0
    mov     r0, #0x1F        @ system mode
    msr     cpsr_c, r0
    ldr     sp, =0x03007F00
    @ copy .data (LMA in ROM) to its VMA
    ldr     r0, =__data_lma
    ldr     r1, =__data_start
    ldr     r2, =__data_end
2:  cmp     r1, r2
    ldrlo   r3, [r0], #4
    strlo   r3, [r1], #4
    blo     2b
    @ copy .iwram code
    ldr     r0, =__iwram_lma
    ldr     r1, =__iwram_start
    ldr     r2, =__iwram_end
3:  cmp     r1, r2
    ldrlo   r3, [r0], #4
    strlo   r3, [r1], #4
    blo     3b
    @ clear .bss
    ldr     r1, =__bss_start
    ldr     r2, =__bss_end
    mov     r3, #0
4:  cmp     r1, r2
    strlo   r3, [r1], #4
    blo     4b
    ldr     r0, =main
    bx      r0
    .pool
