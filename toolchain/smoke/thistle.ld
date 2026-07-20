ENTRY(_start)

SECTIONS {
  . = 0x10000;
  .text : ALIGN(16) { *(.text.start) *(.text .text.*) }
  .rodata : ALIGN(16) { *(.srodata .srodata.* .rodata .rodata.*) }
  .data : ALIGN(16) { *(.sdata .sdata.* .data .data.*) }
  .bss : ALIGN(16) { *(.sbss .sbss.* .bss .bss.* COMMON) }
}
