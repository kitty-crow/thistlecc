import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import type { ConfigLoadResult, ThistleccConfig } from "./types.js";
import { fail, isRegularFile } from "./util.js";

const CONFIG_NAMES = ["thistlecc.json", ".thistlecc.json"] as const;

function stringValue(record: Record<string, unknown>, key: keyof ThistleccConfig): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) fail(`configuration key ${key} must be a non-empty string`, 3);
  return value;
}

function booleanValue(record: Record<string, unknown>, key: keyof ThistleccConfig): boolean | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") fail(`configuration key ${key} must be a boolean`, 3);
  return value;
}

function stringArray(record: Record<string, unknown>, key: keyof ThistleccConfig): string[] | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) {
    fail(`configuration key ${key} must be an array of strings`, 3);
  }
  return [...value] as string[];
}

function parseConfig(text: string, path: string): ThistleccConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    fail(`could not parse ${path}: ${error instanceof Error ? error.message : String(error)}`, 3);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail(`${path} must contain a JSON object`, 3);
  const record = parsed as Record<string, unknown>;
  const allowed = new Set([
    "$schema", "mikuosHome", "converter", "cc", "cxx", "strip", "readelf",
    "toolchainPrefix", "march", "mabi", "sysroot", "outputExtension",
    "reproducible", "colour", "defaultArgs", "converterArgs",
  ]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${path}: unknown configuration key ${key}`, 3);
  }
  if (record.$schema !== undefined && typeof record.$schema !== "string") fail(`${path}: $schema must be a string`, 3);
  const outputExtension = stringValue(record, "outputExtension");
  if (outputExtension !== undefined && outputExtension !== "39" && outputExtension !== "thx") {
    fail(`${path}: outputExtension must be "39" or "thx"`, 3);
  }
  const colour = stringValue(record, "colour");
  if (colour !== undefined && !["auto", "always", "never"].includes(colour)) {
    fail(`${path}: colour must be auto, always or never`, 3);
  }

  const result: ThistleccConfig = {};
  const strings: Array<keyof ThistleccConfig> = [
    "mikuosHome", "converter", "cc", "cxx", "strip", "readelf",
    "toolchainPrefix", "march", "mabi", "sysroot",
  ];
  for (const key of strings) {
    const value = stringValue(record, key);
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  if (outputExtension !== undefined) result.outputExtension = outputExtension as "39" | "thx";
  const reproducible = booleanValue(record, "reproducible");
  if (reproducible !== undefined) result.reproducible = reproducible;
  if (colour !== undefined) result.colour = colour as "auto" | "always" | "never";
  const defaultArgs = stringArray(record, "defaultArgs");
  if (defaultArgs !== undefined) result.defaultArgs = defaultArgs;
  const converterArgs = stringArray(record, "converterArgs");
  if (converterArgs !== undefined) result.converterArgs = converterArgs;
  return result;
}

export function scanConfigArguments(argv: readonly string[]): { path?: string; disabled: boolean } {
  let path: string | undefined;
  let disabled = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--no-config") disabled = true;
    if (argument === "--config") {
      const value = argv[index + 1];
      if (!value) fail("--config requires a path");
      path = value;
      index += 1;
    } else if (argument?.startsWith("--config=")) {
      path = argument.slice("--config=".length);
    }
  }
  return path === undefined ? { disabled } : { path, disabled };
}

export async function loadConfig(cwd: string, explicitPath?: string, disabled = false): Promise<ConfigLoadResult> {
  if (disabled) return { value: {} };

  if (explicitPath) {
    const path = resolve(cwd, explicitPath);
    if (!(await isRegularFile(path))) fail(`configuration file not found: ${path}`, 3);
    return { path, value: parseConfig(await readFile(path, "utf8"), path) };
  }

  let cursor = resolve(cwd);
  while (true) {
    for (const name of CONFIG_NAMES) {
      const candidate = resolve(cursor, name);
      if (await isRegularFile(candidate)) {
        return { path: candidate, value: parseConfig(await readFile(candidate, "utf8"), candidate) };
      }
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  return { value: {} };
}

export function environmentConfig(env: NodeJS.ProcessEnv = process.env): ThistleccConfig {
  const outputExtension = env.THISTLECC_OUTPUT_EXTENSION;
  if (outputExtension !== undefined && outputExtension !== "39" && outputExtension !== "thx") {
    fail("THISTLECC_OUTPUT_EXTENSION must be 39 or thx", 3);
  }

  const result: ThistleccConfig = {};
  const assign = (key: keyof ThistleccConfig, value: string | undefined): void => {
    if (value !== undefined && value.length > 0) (result as Record<string, unknown>)[key] = value;
  };
  assign("mikuosHome", env.MIKUOS_HOME ?? env.THISTLE_HOME);
  assign("converter", env.THISTLECC_CONVERTER ?? env.THISTLE_ELF2THX);
  assign("cc", env.THISTLECC_CC ?? env.THISTLE_CC);
  assign("cxx", env.THISTLECC_CXX ?? env.THISTLE_CXX);
  assign("strip", env.THISTLECC_STRIP);
  assign("readelf", env.THISTLECC_READELF);
  assign("toolchainPrefix", env.THISTLECC_TOOLCHAIN_PREFIX);
  assign("march", env.THISTLECC_MARCH);
  assign("mabi", env.THISTLECC_MABI);
  assign("sysroot", env.THISTLECC_SYSROOT);
  if (outputExtension !== undefined) result.outputExtension = outputExtension;
  return result;
}

export function mergeConfig(...values: readonly ThistleccConfig[]): ThistleccConfig {
  return Object.assign({}, ...values);
}
