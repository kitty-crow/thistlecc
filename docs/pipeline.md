# Compiler pipeline

ThistleCC performs the following steps for a final link:

1. resolve the selected C or C++ driver and target configuration;
2. compile and link for RV64GC with the LP64D ABI;
3. require a static ELF executable;
4. validate its class, machine, entry point and programme headers;
5. copy the loadable segments into a Thistle64 THX2 image;
6. write the destination atomically after validation succeeds.

Compile-only and dependency-generation stages stop before THX
packing and preserve the output expected for that stage.
