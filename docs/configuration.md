# Configuration

A project may provide a ThistleCC JSON configuration describing the
compiler commands, sysroot, target flags, linker flags and paths used
by the hosted toolchain.

Command-line options override configuration values for the current
invocation. `--mikuos-home` selects the project root used to locate
the sysroot and toolchain. `MIKUOS_HOME` provides the same default in
the environment; `THISTLE_HOME` is retained as a legacy alias.

The accepted JSON shape is defined by `thistlecc.schema.json`.
