import { readFileSync } from "fs";
import { WASI } from "wasi";

const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning, ...args) => {
  const type = typeof args[0] == "string" ? args[0] : "";
  const name = typeof warning?.name == "string" ? warning.name : type;
  const message =
    typeof warning == "string" ? warning : String(warning?.message ?? "");
  if (
    name == "ExperimentalWarning" &&
    message.includes("WASI is an experimental feature")
  ) {
    return;
  }
  return originalEmitWarning(warning, ...args);
});

const wasmPath = process.argv[2];
if (!wasmPath) {
  process.stderr.write("usage: node ./.as-test/runners/default.wasi.js <file.wasm>\n");
  process.exit(1);
}

try {
  const wasi = new WASI({
    version: "preview1",
    args: [wasmPath],
    env: process.env,
    preopens: {},
  });

  const binary = readFileSync(wasmPath);
  const module = new WebAssembly.Module(binary);
  const instance = new WebAssembly.Instance(module, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });
  wasi.start(instance);
} catch (error) {
  process.stderr.write("failed to run WASI module: " + String(error) + "\n");
  process.exit(1);
}
