# Driver shim

`thx-cc.c` is the small native shim used by the hosted compiler
commands. It locates the configured compiler driver and forwards the
original arguments.

The TypeScript driver remains responsible for target selection, ELF
validation and THX packing.
