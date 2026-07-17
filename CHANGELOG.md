# Changelog

## 2.0.0 — 2026-07-17

- Rewritten from JavaScript to strict TypeScript for direct Bun execution.
- Updated project terminology to mikuOS, Thistle, Teto, Thistle64 and THX2.
- Changed the default executable suffix from `.thx` to `.39`; both remain the
  same checked THX2 format.
- Changed the default ISA flag from the legacy `rv64g` spelling to `rv64gc`.
- Added compile-only, assembly, preprocessing, dependency and relocatable
  stages without THX conversion.
- Added object/archive-only final links and explicit C/C++ selection.
- Added internal ELF64 RISC-V static-image validation.
- Added internal THX2 length, checksum, machine, version and ISA validation.
- Added atomic output installation.
- Added project configuration discovery and a JSON schema.
- Added mikuOS-home, converter, sysroot and toolchain-prefix discovery.
- Added ELF-only and dual-output modes, stripping, depfiles and work retention.
- Added reproducible prefix maps and disabled linker build IDs by default.
- Added SHA-256 build manifests and `--doctor` diagnostics.
- Preserved legacy environment and option aliases needed to migrate 1.x users.
- Removed the `tcc` package alias to avoid shadowing real TinyCC. Use
  `thistlecc` or `thistle++`.
