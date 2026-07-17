export const VERSION = "2.0.0";

export type Language = "auto" | "c" | "c++";
export type Stage = "link" | "compile" | "assembly" | "preprocess" | "dependencies" | "relocatable";
export type EmitKind = "thx" | "elf" | "both";
export type ExtensionKind = "39" | "thx";
export type ColourMode = "auto" | "always" | "never";

export interface ThistleccConfig {
  mikuosHome?: string;
  converter?: string;
  cc?: string;
  cxx?: string;
  strip?: string;
  readelf?: string;
  toolchainPrefix?: string;
  march?: string;
  mabi?: string;
  sysroot?: string;
  outputExtension?: ExtensionKind;
  reproducible?: boolean;
  colour?: ColourMode;
  defaultArgs?: string[];
  converterArgs?: string[];
}

export interface ConfigLoadResult {
  path?: string;
  value: ThistleccConfig;
}

export interface CliOptions {
  cwd: string;
  configPath?: string;
  noConfig: boolean;
  mikuosHome?: string;
  converter?: string;
  cc?: string;
  cxx?: string;
  stripCommand?: string;
  readelf?: string;
  toolchainPrefix?: string;
  march: string;
  mabi: string;
  sysroot?: string;
  language: Language;
  output?: string;
  outputExtension: ExtensionKind;
  emit: EmitKind;
  keepElf: boolean;
  keepElfPath?: string;
  strip: boolean;
  manifest: boolean;
  manifestPath?: string;
  depfile: boolean;
  depfilePath?: string;
  reproducible: boolean;
  colour: ColourMode;
  verbose: boolean;
  dryRun: boolean;
  keepWork: boolean;
  keepWorkPath?: string;
  doctor: boolean;
  printConfig: boolean;
  unsafeTarget: boolean;
  compilerArgs: string[];
  converterArgs: string[];
}

export interface ResolvedTools {
  compiler: string;
  compilerKind: "cc" | "cxx";
  converter?: string;
  strip?: string;
  readelf?: string;
}

export interface ElfSummary {
  machine: "riscv64";
  type: "executable";
  entry: string;
  programHeaders: number;
  hasInterpreter: boolean;
  hasDynamicSegment: boolean;
}

export interface ThxSummary {
  magic: "THX2";
  machine: "thistle64";
  version: 2;
  isa: "rv64gc";
  entry: number;
  payloadBytes: number;
  metadataBytes: number;
  checksum: string;
}

export interface Manifest {
  schema: "dev.kittycrow.thistlecc.manifest.v2";
  thistlecc: {
    version: string;
    runtime: string;
  };
  target: {
    operatingSystem: "mikuOS";
    kernelSource: "Thistle";
    generatedKernel: "Teto";
    architecture: "Thistle64";
    isa: "RV64GC";
    abi: string;
    executableFormat: "THX2";
  };
  build: {
    stage: Stage;
    emit: EmitKind;
    language: "c" | "c++";
    reproducible: boolean;
    sourceDateEpoch?: string;
    compiler: string;
    compilerVersion?: string;
    converter?: string;
    converterSha256?: string;
    compilerArguments: string[];
    converterArguments?: string[];
  };
  inputs: Array<{ path: string; sha256: string }>;
  outputs: Array<{ path: string; kind: string; bytes: number; sha256: string }>;
}
