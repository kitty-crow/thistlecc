# ThistleCC

**ThistleCC** is the **Thistle Compiler Collection**.

ThistleCC is a host-side compiler driver for C and C++ programmes
targeting the Thistle64 `rv64gc` profile. It invokes a configured
RISC-V toolchain, validates the resulting static ELF image and packs
its loadable segments into a THX2 executable.

## Requirements

- Bun 1.2 or later;
- a RISC-V RV64GC compiler and linker;
- the pinned ThistleASM checkout for THX encoding and validation.

## Use

    npm install
    bun link
    thistlecc --mikuos-home /path/to/project hello.c -o hello.39
    thistle++ --mikuos-home /path/to/project hello.cc -o hello.39

The older `--thistle-home` spelling remains available for existing
build scripts. With no output name, a final link uses `.39`.

## Build stages

The driver accepts normal compiler stages including `-E`, `-S`,
`-c`, `-r`, `-M` and `-MM`. Final links must be static. Dynamic
interpreters and dynamic segments are rejected.

## Documentation

- [Compiler pipeline](docs/pipeline.md)
- [Configuration](docs/configuration.md)
- [ELF to THX](docs/elf-to-thx.md)
- [Hosted toolchain](toolchain/README.md)
- [Changes from 1.x](MIGRATION.md)

## Licence

MIT. See `LICENSE`.
