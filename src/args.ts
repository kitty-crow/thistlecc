import { basename, extname, resolve } from "node:path";
import process from "node:process";
import type { CliOptions, EmitKind, Language, Stage, ThistleccConfig } from "./types.js";
import { fail } from "./util.js";

const CXX_EXTENSIONS = new Set([".cc", ".cp", ".cpp", ".cxx", ".c++", ".CPP", ".C", ".ii"]);
const C_EXTENSIONS = new Set([".c", ".i", ".s", ".S"]);
const LINK_INPUT_EXTENSIONS = new Set([".o", ".a"]);

function takeValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined) fail(`${option} requires a value`);
  return value;
}

function optionalEquals(argument: string, name: string): string | undefined {
  return argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : undefined;
}

function stageFromArguments(args: readonly string[]): Stage {
  if (args.includes("-E")) return "preprocess";
  if (args.includes("-M") || args.includes("-MM")) return "dependencies";
  if (args.includes("-S")) return "assembly";
  if (args.includes("-c")) return "compile";
  if (args.includes("-r")) return "relocatable";
  return "link";
}

export function inferLanguage(args: readonly string[], requested: Language, invocation = process.argv[1] ?? "thistlecc"): "c" | "c++" {
  if (requested !== "auto") return requested;
  const executable = basename(invocation).toLowerCase();
  if (executable.includes("++") || executable.endsWith("cxx")) return "c++";

  let languageOverride: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "-x") languageOverride = args[index + 1];
    if (args[index]?.startsWith("-x") && args[index] !== "-x") languageOverride = args[index]?.slice(2);
  }
  if (languageOverride?.includes("++")) return "c++";
  if (languageOverride === "c" || languageOverride === "cpp-output") return "c";

  return args.some(argument => !argument.startsWith("-") && CXX_EXTENSIONS.has(extname(argument))) ? "c++" : "c";
}

export function inputArguments(args: readonly string[]): string[] {
  const result: string[] = [];
  const optionsWithValues = new Set(["-o", "-I", "-L", "-l", "-x", "-MF", "-MT", "-MQ", "-include", "-isystem", "-iquote", "-idirafter", "--sysroot"]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) continue;
    if (optionsWithValues.has(argument)) {
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) continue;
    const extension = extname(argument);
    if (C_EXTENSIONS.has(extension) || CXX_EXTENSIONS.has(extension) || LINK_INPUT_EXTENSIONS.has(extension)) result.push(argument);
  }
  return result;
}

export function defaultOutput(args: readonly string[], stage: Stage, extension: "39" | "thx"): string | undefined {
  if (stage === "preprocess" || stage === "dependencies") return undefined;
  const inputs = inputArguments(args);
  if (stage !== "link" && inputs.length !== 1) return undefined;
  const first = inputs[0];
  if (!first) return stage === "link" ? `a.${extension}` : undefined;
  const stem = basename(first, extname(first));
  if (stage === "compile") return `${stem}.o`;
  if (stage === "assembly") return `${stem}.s`;
  if (stage === "relocatable") return `${stem}.o`;
  return `${stem}.${extension}`;
}

export interface ParsedArguments {
  options: CliOptions;
  stage: Stage;
  language: "c" | "c++";
}

export function parseArguments(argv: readonly string[], config: ThistleccConfig, cwd = process.cwd()): ParsedArguments {
  const options: CliOptions = {
    cwd: resolve(cwd),
    noConfig: false,
    ...(config.mikuosHome !== undefined ? { mikuosHome: config.mikuosHome } : {}),
    ...(config.converter !== undefined ? { converter: config.converter } : {}),
    ...(config.cc !== undefined ? { cc: config.cc } : {}),
    ...(config.cxx !== undefined ? { cxx: config.cxx } : {}),
    ...(config.strip !== undefined ? { stripCommand: config.strip } : {}),
    ...(config.readelf !== undefined ? { readelf: config.readelf } : {}),
    ...(config.toolchainPrefix !== undefined ? { toolchainPrefix: config.toolchainPrefix } : {}),
    march: config.march ?? "rv64gc",
    mabi: config.mabi ?? "lp64d",
    ...(config.sysroot !== undefined ? { sysroot: config.sysroot } : {}),
    language: "auto",
    outputExtension: config.outputExtension ?? "39",
    emit: "thx",
    keepElf: false,
    strip: false,
    manifest: false,
    depfile: false,
    reproducible: config.reproducible ?? true,
    colour: config.colour ?? "auto",
    verbose: false,
    dryRun: false,
    keepWork: false,
    doctor: false,
    printConfig: false,
    unsafeTarget: false,
    compilerArgs: [...(config.defaultArgs ?? [])],
    converterArgs: [...(config.converterArgs ?? [])],
  };

  let passthrough = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) continue;
    if (passthrough) {
      options.compilerArgs.push(argument);
      continue;
    }
    if (argument === "--") {
      passthrough = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") fail("__HELP__", 0);
    if (argument === "--version") fail("__VERSION__", 0);
    if (argument === "--verbose" || argument === "-v") { options.verbose = true; continue; }
    if (argument === "--dry-run") { options.dryRun = true; options.verbose = true; continue; }
    if (argument === "--doctor" || argument === "--check") { options.doctor = true; continue; }
    if (argument === "--print-config") { options.printConfig = true; continue; }
    if (argument === "--no-config") { options.noConfig = true; continue; }
    if (argument === "--unsafe-target") { options.unsafeTarget = true; continue; }
    if (argument === "--reproducible") { options.reproducible = true; continue; }
    if (argument === "--no-reproducible") { options.reproducible = false; continue; }
    if (argument === "--strip") { options.strip = true; continue; }
    if (argument === "--keep-elf") { options.keepElf = true; options.emit = "both"; continue; }
    if (argument === "--keep-work") { options.keepWork = true; continue; }
    if (argument === "--manifest") { options.manifest = true; continue; }
    if (argument === "--depfile") { options.depfile = true; continue; }

    const mappings: Array<[string, keyof CliOptions]> = [
      ["--config", "configPath"], ["--mikuos-home", "mikuosHome"], ["--thistle-home", "mikuosHome"],
      ["--converter", "converter"], ["--elf2thx", "converter"], ["--cc", "cc"], ["--cxx", "cxx"],
      ["--strip-command", "stripCommand"], ["--readelf", "readelf"], ["--toolchain-prefix", "toolchainPrefix"],
      ["--march", "march"], ["--mabi", "mabi"], ["--sysroot", "sysroot"], ["--cwd", "cwd"],
    ];
    let consumed = false;
    for (const [name, key] of mappings) {
      if (argument === name) {
        (options as unknown as Record<string, unknown>)[key] = takeValue(argv, index, name);
        index += 1;
        consumed = true;
        break;
      }
      const value = optionalEquals(argument, name);
      if (value !== undefined) {
        (options as unknown as Record<string, unknown>)[key] = value;
        consumed = true;
        break;
      }
    }
    if (consumed) continue;

    if (argument === "--language" || argument.startsWith("--language=")) {
      const value = argument === "--language" ? takeValue(argv, index, argument) : argument.slice("--language=".length);
      if (argument === "--language") index += 1;
      if (!["auto", "c", "c++"].includes(value)) fail("--language must be auto, c or c++");
      options.language = value as Language;
      continue;
    }

    if (argument === "--emit" || argument.startsWith("--emit=")) {
      const value = argument === "--emit" ? takeValue(argv, index, argument) : argument.slice("--emit=".length);
      if (argument === "--emit") index += 1;
      if (!["thx", "elf", "both"].includes(value)) fail("--emit must be thx, elf or both");
      options.emit = value as EmitKind;
      continue;
    }

    if (argument === "--output-extension" || argument.startsWith("--output-extension=")) {
      const value = argument === "--output-extension" ? takeValue(argv, index, argument) : argument.slice("--output-extension=".length);
      if (argument === "--output-extension") index += 1;
      if (value !== "39" && value !== "thx") fail("--output-extension must be 39 or thx");
      options.outputExtension = value;
      continue;
    }

    if (argument === "--colour" || argument === "--color" || argument.startsWith("--colour=") || argument.startsWith("--color=")) {
      const value = argument === "--colour" || argument === "--color" ? takeValue(argv, index, argument) : argument.slice(argument.indexOf("=") + 1);
      if (argument === "--colour" || argument === "--color") index += 1;
      if (!["auto", "always", "never"].includes(value)) fail("--colour must be auto, always or never");
      options.colour = value as CliOptions["colour"];
      continue;
    }

    if (argument.startsWith("--keep-elf=")) { options.keepElf = true; options.emit = "both"; options.keepElfPath = argument.slice("--keep-elf=".length); continue; }
    if (argument.startsWith("--keep-work=")) { options.keepWork = true; options.keepWorkPath = argument.slice("--keep-work=".length); continue; }
    if (argument.startsWith("--manifest=")) { options.manifest = true; options.manifestPath = argument.slice("--manifest=".length); continue; }
    if (argument.startsWith("--depfile=")) { options.depfile = true; options.depfilePath = argument.slice("--depfile=".length); continue; }
    if (argument === "--converter-arg") { options.converterArgs.push(takeValue(argv, index, argument)); index += 1; continue; }
    if (argument.startsWith("--converter-arg=")) { options.converterArgs.push(argument.slice("--converter-arg=".length)); continue; }

    if (argument === "-o") { options.output = takeValue(argv, index, argument); index += 1; continue; }
    if (argument.startsWith("-o") && argument.length > 2) { options.output = argument.slice(2); continue; }

    options.compilerArgs.push(argument);
  }

  options.cwd = resolve(cwd, options.cwd);
  const stage = stageFromArguments(options.compilerArgs);
  const language = inferLanguage(options.compilerArgs, options.language);
  if (options.output === undefined) {
    const inferredOutput = defaultOutput(options.compilerArgs, stage, options.outputExtension);
    if (inferredOutput !== undefined) options.output = inferredOutput;
  }

  if (stage !== "link" && options.emit !== "thx") fail("--emit is only meaningful for a final linked executable");
  if (stage !== "link" && options.keepElf) fail("--keep-elf is only meaningful for a final linked executable");
  if (options.strip && stage !== "link") fail("--strip requires a final linked executable");
  if (options.manifest && options.output === undefined) fail("--manifest requires a named output");
  if (options.depfile && (stage === "preprocess" || stage === "dependencies")) fail("--depfile cannot be combined with dependency/preprocessor-only output");

  return { options, stage, language };
}
