    .section .rodata
    .balign 4
    .global assets_bin
assets_bin:
    .incbin "assets.bin"
    .balign 4
    .ascii "SRAM_V113"          @ tells emulators/flashcarts to expect 32 KB battery SRAM
    .balign 4
