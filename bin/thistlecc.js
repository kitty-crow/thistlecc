#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdir, mkdtemp, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import process from "node:process";

const VERSION = "1.0.0";
const CXX_EXTENSIONS = new Set([".cc", ".cp", ".cpp", ".cxx", ".c++", ".CPP", ".C"]);
const SOURCE_EXTENSIONS = new Set([".c", ...CXX_EXTENSIONS]);
const UNSUPPORTED_LINK_MODES = new Set(["-c", "-S", "-E", "-shared", "-pie"]);

function printHelp() {
  console.log(`thistlecc ${VERSION}

Compile C or C++ on the host into a Thistle64 THX executable.

Usage:
  thistlecc [options] input.c [more sources/objects/libraries] -o output.thx
  tcc       [options] input.cpp -o output.thx

Driver options:
  --thistle-home <dir>  Thistle-OS directory containing build/tool/elf2thx.js
  --elf2thx <file>      Explicit path to build/tool/elf2thx.js
  --cc <command>        C compiler (default: riscv64-unknown-linux-musl-gcc)
  --cxx <command>       C++ compiler (default: riscv64-unknown-linux-musl-g++)
  --keep-elf[=<file>]   Preserve the intermediate RV64 ELF
  --verbose, -v         Print commands before running them
  --dry-run             Print commands without running them
  --version             Print version
  --help, -h            Show this help

Environment:
  THISTLE_HOME          Same as --thistle-home
  THISTLE_ELF2THX       Same as --elf2thx
  THISTLE_CC            Same as --cc
  THISTLE_CXX           Same as --cxx

Default target/link flags:
  -march=rv64g -mabi=lp64d -mno-relax -fno-pie
  -static -no-pie -Wl,--no-relax

All unrecognised arguments are passed to GCC/G++.
`);
}

function fail(message, code = 1) {
  console.error(`thistlecc: ${message}`);
  process.exit(code);
}

function quote(arg) {
  if (/^[A-Za-z0-9_./:=+,@%-]+$/.test(arg)) return arg;
  return JSON.stringify(arg);
}

function printCommand(command, args) {
  console.error(`+ ${[command, ...args].map(quote).join(" ")}`);
}

function commandExists(command) {
  const probe = process.platform === "win32" ? "where" : "sh";
  const args = process.platform === "win32"
    ? [command]
    : ["-c", "command -v \"$1\" >/dev/null 2>&1", "sh", command];
  const result = spawnSync(probe, args, { stdio: "ignore", shell: false });
  return result.status === 0;
}

function run(command, args, { verbose, dryRun }) {
  if (verbose || dryRun) printCommand(command, args);
  if (dryRun) return;

  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    windowsHide: false,
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      fail(`command not found: ${command}`);
    }
    fail(`could not start ${command}: ${result.error.message}`);
  }

  if (result.signal) {
    fail(`${command} terminated by signal ${result.signal}`, 128);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function takeValue(argv, index, option) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    fail(`${option} requires a value`);
  }
  return value;
}

function parseArguments(argv) {
  const options = {
    thistleHome: process.env.THISTLE_HOME,
    elf2thx: process.env.THISTLE_ELF2THX,
    cc: process.env.THISTLE_CC || "riscv64-unknown-linux-musl-gcc",
    cxx: process.env.THISTLE_CXX || "riscv64-unknown-linux-musl-g++",
    output: undefined,
    keepElf: false,
    keepElfPath: undefined,
    verbose: false,
    dryRun: false,
    compilerArgs: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--version") {
      console.log(VERSION);
      process.exit(0);
    }
    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      options.verbose = true;
      continue;
    }
    if (arg === "--thistle-home") {
      options.thistleHome = takeValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg.startsWith("--thistle-home=")) {
      options.thistleHome = arg.slice("--thistle-home=".length);
      continue;
    }
    if (arg === "--elf2thx") {
      options.elf2thx = takeValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg.startsWith("--elf2thx=")) {
      options.elf2thx = arg.slice("--elf2thx=".length);
      continue;
    }
    if (arg === "--cc") {
      options.cc = takeValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg.startsWith("--cc=")) {
      options.cc = arg.slice("--cc=".length);
      continue;
    }
    if (arg === "--cxx") {
      options.cxx = takeValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg.startsWith("--cxx=")) {
      options.cxx = arg.slice("--cxx=".length);
      continue;
    }
    if (arg === "--keep-elf") {
      options.keepElf = true;
      continue;
    }
    if (arg.startsWith("--keep-elf=")) {
      options.keepElf = true;
      options.keepElfPath = arg.slice("--keep-elf=".length);
      continue;
    }
    if (arg === "-o") {
      options.output = takeValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg.startsWith("-o") && arg.length > 2) {
      options.output = arg.slice(2);
      continue;
    }

    options.compilerArgs.push(arg);
  }

  return options;
}

function findSources(args) {
  return args.filter((arg) => !arg.startsWith("-") && SOURCE_EXTENSIONS.has(extname(arg)));
}

function hasCxxInput(args) {
  if (args.some((arg) => arg === "-x")) {
    const languageIndex = args.lastIndexOf("-x");
    const language = args[languageIndex + 1];
    if (language && ["c++", "c++-cpp-output", "objective-c++"].includes(language)) return true;
  }
  return args.some((arg) => !arg.startsWith("-") && CXX_EXTENSIONS.has(extname(arg)));
}

function validateCompilerArgs(args) {
  for (const arg of args) {
    if (UNSUPPORTED_LINK_MODES.has(arg)) {
      fail(`${arg} does not produce a linked executable and therefore cannot be converted to THX`);
    }
    if (arg === "-dynamic" || arg.startsWith("-Wl,--dynamic-linker") || arg.startsWith("-Wl,-dynamic-linker")) {
      fail("dynamic executables are unsupported; Thistle THX programs must be statically linked");
    }
  }
}

function defaultOutput(sources) {
  const first = sources[0];
  if (!first) return undefined;
  const stem = basename(first, extname(first));
  return `${stem}.thx`;
}

function candidateImporterPaths(options) {
  const candidates = [];
  if (options.elf2thx) candidates.push(options.elf2thx);
  if (options.thistleHome) candidates.push(join(options.thistleHome, "build", "tool", "elf2thx.js"));

  let cursor = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    candidates.push(join(cursor, "build", "tool", "elf2thx.js"));
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  return [...new Set(candidates.map((path) => resolve(path)))];
}

function findImporter(options) {
  const candidates = candidateImporterPaths(options);
  const importer = candidates.find((path) => existsSync(path) && statSync(path).isFile());
  if (importer) return importer;

  const searched = candidates.map((path) => `  ${path}`).join("\n");
  fail(`could not find build/tool/elf2thx.js. Set --thistle-home or THISTLE_HOME.\nSearched:\n${searched}`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  validateCompilerArgs(options.compilerArgs);

  const sources = findSources(options.compilerArgs);
  if (sources.length === 0) {
    fail("no C or C++ input files were provided");
  }

  options.output ??= defaultOutput(sources);
  if (!options.output) fail("no output path was provided");

  const output = resolve(options.output);
  const importer = findImporter(options);
  const compiler = hasCxxInput(options.compilerArgs) ? options.cxx : options.cc;

  if (!options.dryRun && !commandExists(compiler)) {
    fail(`command not found: ${compiler}\nInstall the RISC-V musl cross-toolchain or override it with --cc/--cxx.`);
  }

  await mkdir(dirname(output), { recursive: true });
  const workDir = await mkdtemp(join(tmpdir(), "thistlecc-"));
  const elfPath = join(workDir, `${basename(output)}.elf`);

  const targetFlags = [
    "-march=rv64g",
    "-mabi=lp64d",
    "-mno-relax",
    "-fno-pie",
    "-static",
    "-no-pie",
    "-Wl,--no-relax",
  ];

  const compilerArgs = [...targetFlags, ...options.compilerArgs, "-o", elfPath];

  try {
    run(compiler, compilerArgs, options);
    run(process.execPath, [importer, elfPath, output], options);

    if (!options.dryRun) {
      if (!existsSync(output) || statSync(output).size === 0) {
        fail(`elf2thx did not produce a valid output file: ${output}`);
      }

      if (options.keepElf) {
        const preservedElf = resolve(options.keepElfPath || `${output}.elf`);
        await mkdir(dirname(preservedElf), { recursive: true });
        await copyFile(elfPath, preservedElf);
        if (options.verbose) console.error(`kept ELF: ${preservedElf}`);
      }

      console.log(output);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
