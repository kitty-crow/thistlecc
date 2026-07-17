import { readFile } from "node:fs/promises";
import type { ElfSummary, ThxSummary } from "./types.js";
import { fail } from "./util.js";

function safeNumber(value: bigint, name: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail(`${name} is too large`, 4);
  return Number(value);
}

export async function inspectElf(path: string): Promise<ElfSummary> {
  const bytes = await readFile(path);
  if (bytes.length < 64) fail(`truncated ELF file: ${path}`, 4);
  if (bytes[0] !== 0x7f || bytes[1] !== 0x45 || bytes[2] !== 0x4c || bytes[3] !== 0x46) fail(`not an ELF file: ${path}`, 4);
  if (bytes[4] !== 2) fail(`ELF is not 64-bit: ${path}`, 4);
  if (bytes[5] !== 1) fail(`ELF is not little-endian: ${path}`, 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = view.getUint16(16, true);
  const machine = view.getUint16(18, true);
  if (type !== 2) fail(`ELF is not ET_EXEC: ${path}`, 4);
  if (machine !== 243) fail(`ELF machine is not RISC-V: ${path}`, 4);

  const entry = view.getBigUint64(24, true);
  const phoff = safeNumber(view.getBigUint64(32, true), "ELF program-header offset");
  const phentsize = view.getUint16(54, true);
  const phnum = view.getUint16(56, true);
  if (phnum > 0 && phentsize < 56) fail(`invalid ELF program-header size: ${path}`, 4);
  if (phoff + phentsize * phnum > bytes.length) fail(`ELF program-header table exceeds file: ${path}`, 4);

  let hasInterpreter = false;
  let hasDynamicSegment = false;
  for (let index = 0; index < phnum; index += 1) {
    const offset = phoff + index * phentsize;
    const segmentType = view.getUint32(offset, true);
    if (segmentType === 3) hasInterpreter = true;
    if (segmentType === 2) hasDynamicSegment = true;
  }
  if (hasInterpreter || hasDynamicSegment) fail(`dynamic ELF images cannot be converted to THX: ${path}`, 4);

  return {
    machine: "riscv64",
    type: "executable",
    entry: `0x${entry.toString(16)}`,
    programHeaders: phnum,
    hasInterpreter,
    hasDynamicSegment,
  };
}

function fnv1a(bytes: Uint8Array): number {
  let value = 0x811c9dc5;
  for (const byte of bytes) {
    value ^= byte;
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

export async function inspectThx(path: string): Promise<ThxSummary> {
  const bytes = await readFile(path);
  if (bytes.length < 16) fail(`truncated THX file: ${path}`, 4);
  const magic = new TextDecoder().decode(bytes.subarray(0, 4));
  if (magic !== "THX2") fail(`expected THX2 output, found ${JSON.stringify(magic)}: ${path}`, 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const metadataBytes = view.getUint32(4, true);
  const payloadBytes = view.getUint32(8, true);
  const checksum = view.getUint32(12, true);
  if (16 + metadataBytes + payloadBytes !== bytes.length) fail(`THX2 length fields do not match output size: ${path}`, 4);
  const actualChecksum = fnv1a(bytes.subarray(16));
  if (checksum !== actualChecksum) fail(`THX2 checksum mismatch: ${path}`, 4);

  let metadata: unknown;
  try {
    metadata = JSON.parse(new TextDecoder().decode(bytes.subarray(16, 16 + metadataBytes)));
  } catch (error) {
    fail(`invalid THX2 metadata: ${error instanceof Error ? error.message : String(error)}`, 4);
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) fail(`invalid THX2 metadata object: ${path}`, 4);
  const record = metadata as Record<string, unknown>;
  if (record.machine !== "thistle64" || record.ver !== 2 || record.isa !== "rv64gc") {
    fail(`THX2 identity mismatch; expected thistle64/version 2/rv64gc: ${path}`, 4);
  }
  if (!Number.isSafeInteger(record.entry) || (record.entry as number) < 0) fail(`invalid THX2 entry address: ${path}`, 4);

  return {
    magic: "THX2",
    machine: "thistle64",
    version: 2,
    isa: "rv64gc",
    entry: record.entry as number,
    payloadBytes,
    metadataBytes,
    checksum: `0x${checksum.toString(16).padStart(8, "0")}`,
  };
}
