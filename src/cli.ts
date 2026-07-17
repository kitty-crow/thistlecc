import process from "node:process";
import { parseArguments } from "./args.js";
import { loadConfig, environmentConfig, mergeConfig, scanConfigArguments } from "./config.js";
import { compile } from "./driver.js";
import { VERSION } from "./types.js";
import { CliError, errorMessage } from "./util.js";

export function helpText(): string {
  return `thistlecc ${VERSION}

Bun-native TypeScript compiler driver for mikuOS Thistle64 RV64GC.
It cross-compiles on the host, validates a static ELF64 RISC-V image, and
converts it to the single THX2 executable format. .39 and .thx are aliases.

Usage:
  thistlecc [driver options] file.c [objects and libraries] -o program.39
  thistle++ [driver options] file.cpp -o program.39
  thistlecc -c file.c -o file.o
  thistlecc -S file.c -o file.s
  thistlecc -E file.c

Core driver options:
  --mikuos-home DIR       mikuOS source tree containing the current converter
  --converter FILE        explicit elf2thx.js/.mjs/.ts path
  --cc COMMAND            RISC-V musl C compiler
  --cxx COMMAND           RISC-V musl C++ compiler
  --toolchain-prefix PFX  e.g. riscv64-unknown-linux-musl-
  --language auto|c|c++   force compiler selection
  --march ARCH            default: rv64gc
  --mabi ABI              default: lp64d
  --sysroot DIR           cross-toolchain sysroot

Output and validation:
  --emit thx|elf|both     default: thx
  --output-extension 39|thx
                          default output suffix: .39
  --keep-elf[=FILE]       preserve the validated intermediate ELF
  --strip                 strip the ELF before conversion
  --strip-command CMD     explicit RISC-V strip command
  --manifest[=FILE]       emit a SHA-256 build manifest
  --depfile[=FILE]        request a compiler dependency file
  --keep-work[=DIR]       preserve intermediate files

Build policy:
  --reproducible          prefix maps and no linker build-id (default)
  --no-reproducible       disable prefix-map additions
  --colour MODE           auto, always or never
  --unsafe-target         permit a non-standard march/mabi
  --converter-arg VALUE   pass one extra argument to the converter

Configuration and diagnostics:
  --config FILE           use an explicit JSON configuration
  --no-config             ignore discovered thistlecc.json files
  --doctor, --check       report toolchain and converter health as JSON
  --print-config          print fully resolved configuration
  --verbose, -v           print commands
  --dry-run               print commands without executing them
  --version               print version
  --help, -h              show this help

Environment:
  MIKUOS_HOME             preferred mikuOS source-tree location
  THISTLE_HOME            legacy alias for MIKUOS_HOME
  THISTLECC_CONVERTER     converter override
  THISTLECC_CC            C compiler override
  THISTLECC_CXX           C++ compiler override
  THISTLECC_TOOLCHAIN_PREFIX
  THISTLECC_MARCH, THISTLECC_MABI, THISTLECC_SYSROOT

Default linked target flags:
  -march=rv64gc -mabi=lp64d -mno-relax -fno-pie
  -static -no-pie -Wl,--no-relax -Wl,--build-id=none

Unknown arguments are passed to GCC/G++ unchanged. Compile-only, assembly and
preprocessor modes remain ordinary ELF/object/text compiler stages and are not
mislabelled as THX.
`;
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  try {
    const scan = scanConfigArguments(argv);
    const fileConfig = await loadConfig(process.cwd(), scan.path, scan.disabled);
    const config = mergeConfig(fileConfig.value, environmentConfig());
    const { options, stage, language } = parseArguments(argv, config);
    await compile(options, stage, language);
    return 0;
  } catch (error) {
    if (error instanceof CliError) {
      if (error.message === "__HELP__") {
        process.stdout.write(helpText());
        return 0;
      }
      if (error.message === "__VERSION__") {
        process.stdout.write(`${VERSION}\n`);
        return 0;
      }
      process.stderr.write(`thistlecc: ${error.message}\n`);
      return error.exitCode;
    }
    process.stderr.write(`thistlecc: ${errorMessage(error)}\n`);
    return 1;
  }
}
