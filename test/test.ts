import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const packageRoot = resolve(process.cwd());
const sourceCli = join(packageRoot, "bin", "thistlecc.ts");
const builtCli = join(packageRoot, "dist", "bin", "thistlecc.js");
const runningUnderBun = Boolean((process.versions as Record<string, string | undefined>).bun);
const cli = runningUnderBun ? sourceCli : builtCli;
const runtime = process.execPath;
const temporary = await mkdtemp(join(tmpdir(), "thistlecc-2-test-"));

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function run(args: string[], cwd = temporary, env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(runtime, [cli, ...args], {
    cwd,
    env,
    encoding: "utf8",
    shell: false,
  });
}

function fnv1a(bytes: Uint8Array): number {
  let value = 0x811c9dc5;
  for (const byte of bytes) {
    value ^= byte;
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

async function assertThx(path: string): Promise<void> {
  const bytes = new Uint8Array(await readFile(path));
  assert(new TextDecoder().decode(bytes.subarray(0, 4)) === "THX2", `${path} is not THX2`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert(view.getUint32(12, true) === fnv1a(bytes.subarray(16)), `${path} checksum mismatch`);
}

try {
  const compiler = join(temporary, "riscv64-unknown-linux-musl-gcc");
  const cxx = join(temporary, "riscv64-unknown-linux-musl-g++");
  const converter = join(temporary, "elf2thx.js");
  const brokenConverter = join(temporary, "broken-elf2thx.js");
  const log = join(temporary, "compiler-args.jsonl");

  const compilerSource = `#!/usr/bin/env node
import { appendFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args.includes("--version")) { console.log("mock-riscv-musl 2.0"); process.exit(0); }
if (args.includes("-dumpmachine")) { console.log("riscv64-unknown-linux-musl"); process.exit(0); }
if (process.env.THISTLECC_MOCK_LOG) appendFileSync(process.env.THISTLECC_MOCK_LOG, JSON.stringify({ exe: process.argv[1], args }) + "\\n");
const oi = args.lastIndexOf("-o");
const output = oi >= 0 ? args[oi + 1] : undefined;
if (!output) { if (args.includes("-E") || args.includes("-M") || args.includes("-MM")) { console.log("hello.o: hello.c"); process.exit(0); } process.exit(2); }
if (args.includes("-c") || args.includes("-S") || args.includes("-r")) {
  writeFileSync(output, Buffer.from(args.includes("-S") ? ".text\\n" : "MOCK-OBJECT"));
  process.exit(0);
}
const elf = Buffer.alloc(64 + 56);
elf[0] = 0x7f; elf[1] = 0x45; elf[2] = 0x4c; elf[3] = 0x46;
elf[4] = 2; elf[5] = 1; elf[6] = 1;
elf.writeUInt16LE(2, 16);
elf.writeUInt16LE(243, 18);
elf.writeUInt32LE(1, 20);
elf.writeBigUInt64LE(0x10000n, 24);
elf.writeBigUInt64LE(64n, 32);
elf.writeUInt16LE(64, 52);
elf.writeUInt16LE(56, 54);
elf.writeUInt16LE(1, 56);
elf.writeUInt32LE(1, 64);
elf.writeUInt32LE(5, 68);
elf.writeBigUInt64LE(0n, 72);
elf.writeBigUInt64LE(0x10000n, 80);
elf.writeBigUInt64LE(0x10000n, 88);
elf.writeBigUInt64LE(BigInt(elf.length), 96);
elf.writeBigUInt64LE(BigInt(elf.length), 104);
elf.writeBigUInt64LE(0x1000n, 112);
writeFileSync(output, elf);
`;

  const converterSource = `import { readFile, writeFile, chmod } from "node:fs/promises";
const args = process.argv.slice(2);
const src = args.at(-2); const dst = args.at(-1);
if (!src || !dst) process.exit(2);
const payload = new Uint8Array(await readFile(src));
const metadata = new TextEncoder().encode(JSON.stringify({ machine: "thistle64", ver: 2, sec: [], sym: [], rel: [], dbg: [], ident: ["thistlecc-test"], entry: 65536, mem: 1073741824, isa: "rv64gc", phdr: 65536, phent: 56, phnum: 1 }));
const out = new Uint8Array(16 + metadata.length + payload.length);
out.set(new TextEncoder().encode("THX2"));
const view = new DataView(out.buffer);
view.setUint32(4, metadata.length, true); view.setUint32(8, payload.length, true);
out.set(metadata, 16); out.set(payload, 16 + metadata.length);
let hash = 0x811c9dc5;
for (const byte of out.subarray(16)) { hash ^= byte; hash = Math.imul(hash, 0x01000193); }
view.setUint32(12, hash >>> 0, true);
await writeFile(dst, out); await chmod(dst, 0o755);
`;

  await writeFile(compiler, compilerSource);
  await writeFile(cxx, compilerSource);
  await writeFile(converter, converterSource);
  await writeFile(brokenConverter, `import { writeFile } from "node:fs/promises"; const a=process.argv.slice(2); await writeFile(a.at(-1), "THX2broken");\n`);
  await chmod(compiler, 0o755);
  await chmod(cxx, 0o755);

  const helloC = join(temporary, "hello.c");
  const helloCpp = join(temporary, "hello.cpp");
  await writeFile(helloC, "int main(void) { return 0; }\n");
  await writeFile(helloCpp, "int main() { return 0; }\n");

  const version = run(["--version"]);
  assert(version.status === 0, `--version failed: ${version.stderr}`);
  assert(version.stdout.trim() === "2.0.0", "wrong version");

  const basic = run(["--cc", compiler, "--converter", converter, helloC], temporary, { ...process.env, THISTLECC_MOCK_LOG: log });
  assert(basic.status === 0, `basic C build failed:\n${basic.stdout}\n${basic.stderr}`);
  const defaultOutput = join(temporary, "hello.39");
  await assertThx(defaultOutput);

  const richOutput = join(temporary, "rich.thx");
  const rich = run([
    "--cc", compiler,
    "--converter", converter,
    "--keep-elf",
    "--manifest",
    "--output-extension", "thx",
    helloC,
    "-O2",
    "-o", richOutput,
  ], temporary, { ...process.env, THISTLECC_MOCK_LOG: log, SOURCE_DATE_EPOCH: "0" });
  assert(rich.status === 0, `manifest build failed:\n${rich.stdout}\n${rich.stderr}`);
  await assertThx(richOutput);
  assert((await stat(`${richOutput}.elf`)).size > 64, "kept ELF missing");
  const manifest = JSON.parse(await readFile(`${richOutput}.manifest.json`, "utf8")) as Record<string, unknown>;
  assert(manifest.schema === "dev.kittycrow.thistlecc.manifest.v2", "manifest schema mismatch");
  assert(JSON.stringify(manifest).includes("mikuOS"), "manifest identity missing");

  const cppOutput = join(temporary, "cpp.39");
  const cpp = run(["--cc", "/definitely/not/cc", "--cxx", cxx, "--converter", converter, helloCpp, "-o", cppOutput], temporary, { ...process.env, THISTLECC_MOCK_LOG: log });
  assert(cpp.status === 0, `C++ selection failed:\n${cpp.stdout}\n${cpp.stderr}`);
  await assertThx(cppOutput);

  const object = join(temporary, "hello.o");
  const compileOnly = run(["--cc", compiler, "-c", helloC, "-o", object], temporary, { ...process.env, THISTLECC_MOCK_LOG: log });
  assert(compileOnly.status === 0, `compile-only failed:\n${compileOnly.stdout}\n${compileOnly.stderr}`);
  assert((await readFile(object, "utf8")) === "MOCK-OBJECT", "compile-only output mismatch");


  const elfOnly = join(temporary, "only.elf");
  const elfOnlyResult = run([
    "--cc", compiler,
    "--emit=elf",
    "--manifest",
    helloC,
    "-o", elfOnly,
  ], temporary, { ...process.env, THISTLECC_MOCK_LOG: log });
  assert(elfOnlyResult.status === 0, `ELF-only build failed:
${elfOnlyResult.stdout}
${elfOnlyResult.stderr}`);
  assert((await stat(elfOnly)).size > 64, "ELF-only output missing");
  assert((await stat(`${elfOnly}.manifest.json`)).size > 0, "ELF-only manifest missing");

  const dependencies = run(["--cc", compiler, "-M", helloC], temporary, { ...process.env, THISTLECC_MOCK_LOG: log });
  assert(dependencies.status === 0, `dependency mode failed:
${dependencies.stdout}
${dependencies.stderr}`);

  const invalidEmit = run(["--emit=banana", "--cc", compiler, helloC]);
  assert(invalidEmit.status !== 0 && invalidEmit.stderr.includes("--emit must be"), "invalid --emit value was accepted");

  const invalidTarget = run(["--cc", compiler, "--converter", converter, "-march=rv64imac", helloC, "-o", join(temporary, "wrong-target.39")]);
  assert(invalidTarget.status !== 0 && invalidTarget.stderr.includes("unsupported mikuOS target architecture"), "unsupported user -march was accepted");

  const shared = run(["--cc", compiler, "--converter", converter, "-shared", helloC, "-o", join(temporary, "shared.39")]);
  assert(shared.status !== 0 && shared.stderr.includes("dynamic or position-independent"), "-shared was not rejected");

  const brokenOutput = join(temporary, "broken.39");
  const broken = run(["--cc", compiler, "--converter", brokenConverter, helloC, "-o", brokenOutput]);
  assert(broken.status !== 0 && broken.stderr.includes("truncated THX"), "broken converter output was not rejected");
  let brokenExists = true;
  try { await stat(brokenOutput); } catch { brokenExists = false; }
  assert(!brokenExists, "invalid THX output was installed");

  const configured = join(temporary, "configured");
  await writeFile(join(temporary, "thistlecc.json"), JSON.stringify({ cc: compiler, cxx, converter, outputExtension: "39", defaultArgs: ["-O3"] }));
  await writeFile(join(temporary, "configured.c"), "int main(void){return 0;}\n");
  const configuredResult = run([join(temporary, "configured.c"), "-o", configured]);
  assert(configuredResult.status === 0, `configuration discovery failed:\n${configuredResult.stdout}\n${configuredResult.stderr}`);
  await assertThx(configured);

  const doctor = run(["--cc", compiler, "--converter", converter, "--doctor"]);
  assert(doctor.status === 0, `doctor failed:\n${doctor.stdout}\n${doctor.stderr}`);
  const report = JSON.parse(doctor.stdout) as Record<string, unknown>;
  assert(report.thistlecc === "2.0.0", "doctor version mismatch");

  const argumentLog = await readFile(log, "utf8");
  assert(argumentLog.includes("-march=rv64gc"), "RV64GC target flag missing");
  assert(argumentLog.includes("-mabi=lp64d"), "LP64D target flag missing");
  assert(argumentLog.includes("--build-id=none"), "deterministic linker flag missing");

  console.log("thistlecc 2.0.0 tests passed");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
