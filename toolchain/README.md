# Hosted toolchain

This directory contains the host-side files used to build Thistle64
C and C++ programmes: the compiler driver shim, target patches,
smoke-test sources and release metadata.

The installed compiler and sysroot are build products. Their source,
versions and checksums are recorded by the toolchain lock files.

Subdirectories:

- `driver` contains the native driver shim;
- `hosted` contains small C and C++ build examples;
- `patches` contains target-specific upstream patches;
- `smoke` contains toolchain validation inputs.
