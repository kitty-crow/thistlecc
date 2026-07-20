# ELF to THX

The input to the packer is a 64-bit little-endian RISC-V ELF image.
It must contain a valid entry point and loadable programme segments.
Dynamic interpreters and dynamic segments are not supported.

Each loadable segment contributes its virtual address, file bytes,
memory size and permissions to the THX2 image. Zero-filled memory is
represented by the difference between the file and memory sizes.

The output machine is `thistle64` and the instruction profile is
`rv64gc`. `.thx` and `.39` select the same bytes.
