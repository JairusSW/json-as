// env-ABI host for the runtime comparison, used to run the real json-as classic
// benches under v8 and bun. It supplies the `env` imports the bench lib needs
// (readFile / writeFile / console.log / performance.now / Date.now / abort) and
// calls the exported `start`, so the bench self-measures exactly as it does
// under the WASI runtimes - only the host ABI differs. writeFile is rerouted to
// stdout as an __AS_BENCH_JSON__ line so run-bench.runtimes.sh captures results
// uniformly across every runtime.
//
//   v8:  v8  --module bench/runners/runtimes-env.mjs -- <wasm>
//   bun: bun bench/runners/runtimes-env.mjs <wasm>
const isV8 = typeof readbuffer === "function";
const print =
  typeof globalThis.print === "function" ? globalThis.print : console.log;

let wasmPath, fs;
if (isV8) {
  wasmPath = arguments[0];
} else {
  fs = await import("node:fs");
  wasmPath = Bun.argv[2];
}

const bytes = isV8
  ? new Uint8Array(readbuffer(wasmPath))
  : new Uint8Array(fs.readFileSync(wasmPath));

const ARRAYBUFFER_ID = 1;
let memory = null;

const { exports } = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
  env: {
    abort: (msg, file, line, col) => {
      print(`abort: ${liftString(msg)} in ${liftString(file)}:${line}:${col}`);
      throw new Error("aborted");
    },
    "console.log": (ptr) => print(liftString(ptr)),
    "Date.now": () => Date.now(),
    "performance.now": () => performance.now(),
    // The bench's dumpToFile writes results via writeFile; reroute to stdout so
    // the shell captures them the same way it does the WASI runtimes' stdout.
    writeFile: (namePtr, dataPtr) =>
      print(`__AS_BENCH_JSON__${liftString(namePtr)}\t${liftString(dataPtr)}`),
    readFile: (pathPtr) => {
      const path = liftString(pathPtr);
      const data = isV8 ? readbuffer(path) : fs.readFileSync(path);
      return lowerBuffer(new Uint8Array(data));
    },
  },
});

memory = exports.memory;
exports.start();

function liftString(pointer) {
  if (!pointer) return null;
  const end =
    (pointer + new Uint32Array(memory.buffer)[(pointer - 4) >>> 2]) >>> 1;
  const memoryU16 = new Uint16Array(memory.buffer);
  let start = pointer >>> 1;
  let string = "";
  while (end - start > 1024)
    string += String.fromCharCode(
      ...memoryU16.subarray(start, (start += 1024)),
    );
  return string + String.fromCharCode(...memoryU16.subarray(start, end));
}

function lowerBuffer(value) {
  if (value == null) return 0;
  const pointer = exports.__new(value.byteLength, ARRAYBUFFER_ID) >>> 0;
  new Uint8Array(memory.buffer).set(value, pointer);
  return pointer;
}
