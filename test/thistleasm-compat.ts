import { codec, Exe } from "../vendor/thistle-asm/fmt.ts";

const executable = new Exe("thistle64");
executable.isa = "rv64gc";
executable.entry = 0x10000;
const bytes = codec.pack(executable);
const decoded = codec.unpack(bytes);
if (!(decoded instanceof Exe) || decoded.machine !== "thistle64" || decoded.isa !== "rv64gc") {
  throw new Error("ThistleASM rejected the ThistleCC target profile");
}
console.log("ThistleCC and ThistleASM target compatibility passed");
