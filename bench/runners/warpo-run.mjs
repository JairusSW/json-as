// Minimal v8 host for the asc-vs-warpo compiler benches (scripts/run-bench.warpo.sh).
// The self-contained harness from gen-warpo-bench.mjs imports only env.now / env.log
// (plus env.abort), times itself, and prints one JSON result line. We just supply
// those and call the exported run().
//
//   v8: v8 --module bench/runners/warpo-run.mjs -- <wasm>
const bytes = new Uint8Array(readbuffer(arguments[0]));
let memory = null;

const { exports } = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
  env: {
    now: () => performance.now(),
    log: (ptr) => print(liftString(ptr)),
    abort: (msg, file, line, col) => {
      print(`abort: ${liftString(msg)} at ${liftString(file)}:${line}:${col}`);
      throw new Error("aborted");
    },
  },
});

memory = exports.memory;
// Top-level init runs via the wasm start section on instantiation; then drive run().
exports.run();

function liftString(pointer) {
  if (!pointer) return "";
  const len = new Uint32Array(memory.buffer)[(pointer - 4) >>> 2] >>> 1;
  const u16 = new Uint16Array(memory.buffer);
  let s = "";
  const base = pointer >>> 1;
  for (let i = 0; i < len; i++) s += String.fromCharCode(u16[base + i]);
  return s;
}
