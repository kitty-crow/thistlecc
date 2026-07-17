# Migrating from thistlecc 1.x

The package directory can replace the old `thistlecc` directory directly.
Version 2 is source-compatible with the normal 1.x linked-build invocation:

```sh
thistlecc --thistle-home /path/to/project source.c -o source.thx
```

Preferred 2.0 spelling:

```sh
thistlecc --mikuos-home /path/to/project source.c -o source.39
```

Important changes:

1. The executable is now `bin/thistlecc.ts`, run directly by Bun.
2. The package no longer publishes the ambiguous `tcc` alias. It publishes
   `thistlecc` and `thistle++`.
3. With no `-o`, a final link defaults to `.39` rather than `.thx`.
4. The default target is explicitly `rv64gc`, LP64D.
5. `-c`, `-S`, `-E`, `-M`, `-MM` and `-r` are now valid compiler stages.
6. Invalid or dynamic ELF and malformed THX output are rejected before the
   destination file is replaced.
7. `MIKUOS_HOME` is preferred. `THISTLE_HOME` remains a legacy alias.
8. Existing scripts that hard-code `bin/thistlecc.js` must be updated to run
   `bun bin/thistlecc.ts`, or use the `thistlecc` command after `bun link`.

The compiler does not solve missing target syscalls. A valid THX2 utility that
returns `ENOSYS` is blocked by the active kernel/runtime implementation, not by
thistlecc.
