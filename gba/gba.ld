OUTPUT_ARCH(arm)
ENTRY(_start)
MEMORY {
  rom   (rx)  : ORIGIN = 0x08000000, LENGTH = 32M
  iwram (rwx) : ORIGIN = 0x03000000, LENGTH = 31K   /* top 1K is stacks / BIOS vars */
  ewram (rwx) : ORIGIN = 0x02000000, LENGTH = 256K
}
SECTIONS {
  .text : { KEEP(*(.text.start)) *(.text .text.*) *(.rodata .rodata.*) *(.glue_7*) . = ALIGN(4); } > rom
  .iwram : { __iwram_start = .; *(.iwram .iwram.*) . = ALIGN(4); __iwram_end = .; } > iwram AT> rom
  __iwram_lma = LOADADDR(.iwram);
  .data : { __data_start = .; *(.data .data.*) *(.ewram .ewram.*) . = ALIGN(4); __data_end = .; } > ewram AT> rom
  __data_lma = LOADADDR(.data);
  .bss (NOLOAD) : { __bss_start = .; *(.bss .bss.* COMMON) *(.sbss) . = ALIGN(4); __bss_end = .; } > ewram
  /DISCARD/ : { *(.ARM.exidx*) *(.comment) *(.note*) *(.eh_frame*) }
}
