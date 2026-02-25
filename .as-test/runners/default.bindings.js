import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

let patched = false;

function readExact(length) {
  const out = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    let read = 0;
    try {
      read = fs.readSync(0, out, offset, length - offset, null);
    } catch (error) {
      if (error && error.code === "EAGAIN") {
        continue;
      }
      throw error;
    }
    if (!read) break;
    offset += read;
  }
  const view = out.subarray(0, offset);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

function writeRaw(data) {
  const view = Buffer.from(data);
  fs.writeSync(1, view);
}

function withNodeIo(imports = {}) {
  if (!patched) {
    patched = true;
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk, ...args) => {
      if (chunk instanceof ArrayBuffer) {
        writeRaw(chunk);
        return true;
      }
      return originalWrite(chunk, ...args);
    };
    process.stdin.read = (size) => readExact(Number(size ?? 0));
  }
  return imports;
}

const wasmPathArg = process.argv[2];
if (!wasmPathArg) {
  process.stderr.write("usage: node ./.as-test/runners/default.bindings.js <file.wasm>\n");
  process.exit(1);
}

const wasmPath = path.resolve(process.cwd(), wasmPathArg);
const jsPath = wasmPath.replace(/\.wasm$/, ".js");

try {
  const binary = fs.readFileSync(wasmPath);
  const module = new WebAssembly.Module(binary);
  const mod = await import(pathToFileURL(jsPath).href);
  if (typeof mod.instantiate !== "function") {
    throw new Error("bindings helper missing instantiate export");
  }
  mod.instantiate(module, withNodeIo({}));
} catch (error) {
  process.stderr.write("failed to run bindings module: " + String(error) + "\n");
  process.exit(1);
}
