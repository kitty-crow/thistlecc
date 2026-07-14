# thistlecc

A standalone, host-side Bun compiler driver for Thistle64.

It runs a locally installed RISC-V musl GCC/G++ cross-compiler to produce a static RV64 ELF, then invokes Thistle-OS's existing `build/tool/elf2thx.js` to create a `.thx` executable.

It does **not** run inside Thistle and it does **not** modify the Thistle source tree.

## Requirements

- Bun
- `riscv64-unknown-linux-musl-gcc`
- `riscv64-unknown-linux-musl-g++` for C++
- An extracted and built Thistle-OS tree containing `build/tool/elf2thx.js`

## Run directly

```sh
bun ./bin/thistlecc.js \
  --thistle-home /path/to/Thistle-OS-2.1.0 \
  hello.c -o hello.thx
```

For C++:

```sh
bun ./bin/thistlecc.js \
  --thistle-home /path/to/Thistle-OS-2.1.0 \
  hello.cpp -O2 -o hello.thx
```

## Configure the Thistle location once

Linux/macOS:

```sh
export THISTLE_HOME=/path/to/Thistle-OS-2.1.0
```

PowerShell:

```powershell
$env:THISTLE_HOME = "C:\path\to\Thistle-OS-2.1.0"
```

Then:

```sh
bun ./bin/thistlecc.js hello.c -o hello.thx
```

The output name is optional. With no `-o`, `hello.c` becomes `hello.thx`.

## Install command aliases

From this directory:

```sh
bun link
```

This package exposes both names:

```sh
thistlecc hello.c -o hello.thx
tcc hello.cpp -O2 -o hello.thx
```

`tcc` may conflict with the real TinyCC command if it is installed on the host. Use `thistlecc` in that case.

## Environment overrides

```sh
THISTLE_CC=/custom/path/riscv64-unknown-linux-musl-gcc
THISTLE_CXX=/custom/path/riscv64-unknown-linux-musl-g++
THISTLE_ELF2THX=/path/to/build/tool/elf2thx.js
```

Equivalent command-line options are available:

```sh
thistlecc \
  --cc my-riscv-gcc \
  --cxx my-riscv-g++ \
  --elf2thx /path/to/elf2thx.js \
  hello.c -o hello.thx
```

## Default target flags

The driver always supplies:

```text
-march=rv64g
-mabi=lp64d
-mno-relax
-fno-pie
-static
-no-pie
-Wl,--no-relax
```

Additional GCC/G++ arguments are passed through unchanged.

## Keep the intermediate ELF

```sh
thistlecc --keep-elf hello.c -o hello.thx
```

This also writes `hello.thx.elf`. A custom location can be supplied:

```sh
thistlecc --keep-elf=build/hello.elf hello.c -o hello.thx
```

## Verbose and dry-run modes

```sh
thistlecc --verbose hello.c -o hello.thx
thistlecc --dry-run hello.cpp -O3 -o hello.thx
```
