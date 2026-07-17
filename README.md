# thistlecc 2.0.0

`thistlecc` is the host-side C/C++ compiler driver for **mikuOS**.

It runs a RISC-V musl cross-compiler on the host, validates the resulting
static ELF64 RISC-V executable, then invokes the current mikuOS
`elf2thx` converter to create a checked **Thistle64 RV64GC THX2** executable.
The source kernel is **Thistle**; **Teto** is the WebAssembly kernel generated
from Thistle. The compiler output ABI is identical under either active kernel.

`.39` and `.thx` are exactly the same executable format. Version 2 defaults to
`.39`, while accepting either suffix.

## What changed in 2.0

- rewritten as strict TypeScript and executed directly by Bun;
- mikuOS/Thistle/Teto terminology replaces the old “Thistle-OS” wording;
- RV64GC and LP64D are explicit, validated target defaults;
- `.39` is the default suffix and `.thx` remains a first-class alias;
- compile-only (`-c`), assembly (`-S`), preprocessing (`-E`) and relocatable
  (`-r`) stages work as ordinary compiler stages instead of being rejected;
- final links are checked internally as static little-endian RISC-V ET_EXEC;
- generated THX2 length, FNV-1a checksum, machine, version and ISA are verified;
- partial outputs are never installed: final files are copied atomically;
- C++ selection works by extension, `thistle++`, `-x c++`, or `--language`;
- object-only and archive links are supported;
- compiler, converter, sysroot and toolchain-prefix configuration is supported;
- project-local `thistlecc.json` discovery is supported;
- reproducible prefix maps and disabled linker build IDs are enabled by default;
- optional depfiles, ELF preservation, stripping, work retention and build
  manifests are available;
- `--doctor` reports the resolved toolchain and target as JSON;
- legacy `THISTLE_HOME`, `THISTLE_CC`, `THISTLE_CXX` and `--elf2thx` remain
  accepted for migration.

## Requirements

- Bun 1.2 or newer;
- a RISC-V musl cross-toolchain, normally:
  - `riscv64-unknown-linux-musl-gcc`;
  - `riscv64-unknown-linux-musl-g++`;
  - optional matching `strip` and `readelf`;
- a current built mikuOS source tree containing `build/tool/elf2thx.js`, or
  the source converter at `src/tool/elf2thx.ts`.

## Install or run directly

```sh
bun link
thistlecc --version
```

No JavaScript build is required. The executable entry point is
`bin/thistlecc.ts` with a Bun shebang.

Direct execution:

```sh
bun ./bin/thistlecc.ts --mikuos-home /path/to/mikuOS hello.c -o hello.39
```

## Typical builds

C:

```sh
thistlecc --mikuos-home /path/to/project hello.c -O2 -o hello.39
```

C++:

```sh
thistle++ --mikuos-home /path/to/project hello.cpp -std=c++23 -O2 -o hello.39
```

Multiple sources and libraries:

```sh
thistlecc main.c account-db.c -Iinclude -Llib -lfoo -o account-tool.39
```

The account utilities can therefore be built without invoking the currently
unfinished native GCC execution path inside Teto.

## Ordinary compiler stages

These do not run `elf2thx`:

```sh
thistlecc -E source.c > source.i
thistlecc -S source.c -o source.s
thistlecc -c source.c -o source.o
thistlecc -r one.o two.o -o combined.o
```

Only a final static ET_EXEC link becomes THX2.

## Preserve and inspect the intermediate ELF

```sh
thistlecc --keep-elf program.c -o program.39
```

This writes `program.39.elf`. A custom path is accepted:

```sh
thistlecc --keep-elf=build/program.elf program.c -o program.39
```

Use `--emit=elf` to stop after the validated static ELF or `--emit=both` to
produce both files.

## Reproducible build manifest

```sh
SOURCE_DATE_EPOCH=0 thistlecc \
  --manifest \
  --keep-elf \
  source.c -O2 -o source.39
```

The manifest records target identity, exact compiler and converter arguments,
input/output SHA-256 hashes, converter hash and compiler version. It deliberately
makes no claim that a successful build can run until the target kernel's
required syscalls are present.

## Diagnostics

```sh
thistlecc --mikuos-home . --doctor
```

This checks compiler discovery, `-dumpmachine`, compiler version, converter
location and target settings. It does not execute code inside mikuOS.

## Configuration

`thistlecc` searches the current directory and its parents for
`thistlecc.json` or `.thistlecc.json`.

```json
{
  "$schema": "./thistlecc.schema.json",
  "mikuosHome": ".",
  "toolchainPrefix": "riscv64-unknown-linux-musl-",
  "march": "rv64gc",
  "mabi": "lp64d",
  "outputExtension": "39",
  "reproducible": true,
  "defaultArgs": ["-O2", "-Wall", "-Wextra", "-Werror"]
}
```

Use `--config FILE` for an explicit file or `--no-config` to disable discovery.
Command-line options override environment variables, which override the file.

Preferred environment variables:

```sh
export MIKUOS_HOME="/path/to/project"
export THISTLECC_CC=riscv64-unknown-linux-musl-gcc
export THISTLECC_CXX=riscv64-unknown-linux-musl-g++
```

## Default linked target flags

```text
-march=rv64gc
-mabi=lp64d
-mno-relax
-fno-pie
-static
-no-pie
-Wl,--no-relax
-Wl,--build-id=none
```

Reproducible mode also adds file, macro and debug prefix maps from the working
directory to `.`. User-supplied equivalents take precedence.

## Security and correctness boundary

`thistlecc` verifies the build artefact, not the completeness of the running
kernel. A valid account utility may still receive `ENOSYS` if Teto or its
compatibility bridge does not yet implement a filesystem operation used by the
program. That is a kernel/runtime integration failure, not a compiler failure.

Dynamic loaders, shared executables and PIE are rejected. The tool does not
silently produce a Linux executable under a `.39` or `.thx` name.
