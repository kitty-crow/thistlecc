# Changes from ThistleCC 1.x

Version 2 keeps the original linked-build form:

    thistlecc --thistle-home /path/to/project source.c -o source.thx

The preferred spelling is:

    thistlecc --mikuos-home /path/to/project source.c -o source.39

The executable is now `bin/thistlecc.ts` and is run by Bun. Installed
commands are `thistlecc` and `thistle++`; the old `tcc` alias is not
provided. Scripts that called `bin/thistlecc.js` should use the
installed command or `bun bin/thistlecc.ts`.
