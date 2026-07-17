import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, chmod, copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

export class CliError extends Error {
  constructor(message: string, readonly exitCode = 2) {
    super(message);
    this.name = "CliError";
  }
}

export function fail(message: string, exitCode = 2): never {
  throw new CliError(message, exitCode);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function quoteArgument(value: string): string {
  if (/^[A-Za-z0-9_./:=+,@%~-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function printCommand(command: string, args: readonly string[]): void {
  process.stderr.write(`+ ${[command, ...args].map(quoteArgument).join(" ")}\n`);
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  verbose?: boolean;
  dryRun?: boolean;
  capture?: boolean;
  allowFailure?: boolean;
}

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function run(command: string, args: readonly string[], options: RunOptions = {}): RunResult {
  if (options.verbose || options.dryRun) printCommand(command, args);
  if (options.dryRun) return { status: 0, stdout: "", stderr: "" };

  const result = spawnSync(command, [...args], {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    shell: false,
    windowsHide: false,
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") fail(`command not found: ${command}`, 127);
    fail(`could not start ${command}: ${result.error.message}`, 126);
  }

  if (result.signal) fail(`${command} terminated by signal ${result.signal}`, 128);

  const status = result.status ?? 1;
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";

  if (status !== 0 && !options.allowFailure) {
    if (options.capture) {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    }
    throw new CliError(`${basename(command)} failed with status ${status}`, status);
  }

  return { status, stdout, stderr };
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isRegularFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export function commandExists(command: string): boolean {
  if (command.includes("/") || command.includes("\\") || isAbsolute(command)) {
    try {
      const result = spawnSync(command, ["--version"], { stdio: "ignore", shell: false });
      return !(result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT");
    } catch {
      return false;
    }
  }

  const probe = process.platform === "win32" ? "where" : "sh";
  const args = process.platform === "win32"
    ? [command]
    : ["-c", "command -v \"$1\" >/dev/null 2>&1", "sh", command];
  const result = spawnSync(probe, args, { stdio: "ignore", shell: false });
  return result.status === 0;
}

export function firstExistingCommand(candidates: readonly string[]): string | undefined {
  return candidates.find(commandExists);
}

export async function sha256File(path: string): Promise<string> {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

export async function atomicCopy(source: string, destination: string, mode?: number): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = resolve(dirname(destination), `.${basename(destination)}.thistlecc-${process.pid}-${Date.now()}`);
  try {
    await copyFile(source, temporary);
    if (mode !== undefined) await chmod(temporary, mode);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

export async function atomicWrite(destination: string, content: string | Uint8Array, mode?: number): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = resolve(dirname(destination), `.${basename(destination)}.thistlecc-${process.pid}-${Date.now()}`);
  try {
    await writeFile(temporary, content);
    if (mode !== undefined) await chmod(temporary, mode);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

export function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? resolve(path) : resolve(cwd, path);
}

export function sourceDateEpoch(env: NodeJS.ProcessEnv): string | undefined {
  const value = env.SOURCE_DATE_EPOCH;
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  return value;
}
