import { instantiate } from "as-test/lib";

const wasmPath = process.argv[2];
if (!wasmPath) throw new Error("Expected a WebAssembly test file path");

process.env.AS_TEST_WASM_PATH = wasmPath;
const instance = await instantiate({});
instance.exports.start?.();
