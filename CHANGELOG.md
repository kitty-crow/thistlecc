# Changes

## 2.0.0

- rewrote the driver in TypeScript for Bun;
- added C and C++ entry points;
- added compile, assembly, dependency and relocatable-link stages;
- made RV64GC and LP64D explicit target settings;
- validated ELF and THX output before replacing the destination;
- changed the default final extension to `.39`;
- removed the ambiguous `tcc` command alias.

## 1.0.0

- introduced the linked C compiler driver;
- added static RV64 ELF validation and THX conversion.
