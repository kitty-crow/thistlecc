import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const root = resolve(new URL("..", import.meta.url).pathname);
const cli = join(root, "bin", "thistlecc.js");
const temp = await mkdtemp(join(tmpdir(), "thistlecc-test-"));

function run(args, cwd = temp) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
}

try {
  const compiler = join(temp, "mock-compiler.js");
  const importer = join(temp, "mock-elf2thx.js");
  const cSource = join(temp, "hello.c");
  const cppSource = join(temp, "hello.cpp");

  await writeFile(compiler, `#!/usr/bin/env node\nimport { writeFileSync } from "node:fs";\nconst args = process.argv.slice(2);\nconst i = args.lastIndexOf("-o");\nif (i < 0 || !args[i + 1]) process.exit(2);\nwriteFileSync(args[i + 1], Buffer.from("FAKE-RV64-ELF"));\n`);
  await writeFile(importer, `import { readFile, writeFile, chmod } from "node:fs/promises";\nconst [src, dst] = process.argv.slice(2);\nconst input = await readFile(src);\nawait writeFile(dst, Buffer.concat([Buffer.from("THX2"), input]));\nawait chmod(dst, 0o755);\n`);
  await writeFile(cSource, "int main(void) { return 0; }\n");
  await writeFile(cppSource, "int main() { return 0; }\n");
  await chmod(compiler, 0o755);

  const cOutput = join(temp, "hello-c.thx");
  const cResult = run([
    "--cc", compiler,
    "--elf2thx", importer,
    cSource,
    "-O2",
    "-o", cOutput,
  ]);
  if (cResult.status !== 0) {
    throw new Error(`C test failed:\n${cResult.stdout}\n${cResult.stderr}`);
  }
  const cBytes = await readFile(cOutput, "utf8");
  if (cBytes !== "THX2FAKE-RV64-ELF") throw new Error("C output content mismatch");

  const cppOutput = join(temp, "hello-cpp.thx");
  const cppResult = run([
    "--cxx", compiler,
    "--elf2thx", importer,
    cppSource,
    "-o", cppOutput,
    "--keep-elf",
  ]);
  if (cppResult.status !== 0) {
    throw new Error(`C++ test failed:\n${cppResult.stdout}\n${cppResult.stderr}`);
  }
  const cppBytes = await readFile(cppOutput, "utf8");
  if (cppBytes !== "THX2FAKE-RV64-ELF") throw new Error("C++ output content mismatch");
  const keptElf = await readFile(`${cppOutput}.elf`, "utf8");
  if (keptElf !== "FAKE-RV64-ELF") throw new Error("kept ELF content mismatch");

  const rejected = run([
    "--cc", compiler,
    "--elf2thx", importer,
    "-c",
    cSource,
    "-o", join(temp, "bad.thx"),
  ]);
  if (rejected.status === 0 || !rejected.stderr.includes("does not produce a linked executable")) {
    throw new Error("-c mode was not rejected correctly");
  }

  console.log("thistlecc tests passed");
} finally {
  await rm(temp, { recursive: true, force: true });
}
