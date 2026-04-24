import { JSON, JSONMode } from "../..";
// @ts-ignore: decorator allowed
@external("env", "writeFile")
export declare function writeFile(fileName: string, data: string): void;

// @ts-ignore: decorator allowed
@external("env", "readFile")
export declare function readFileBuffer(filePath: string): ArrayBuffer;

// @ts-expect-error: AS_BENCH_RUNTIME_WAVM may be undefined.
const BENCH_RUNTIME_WAVM: bool = isDefined(AS_BENCH_RUNTIME_WAVM);
const BENCH_RUNTIME_STDOUT: bool = BENCH_RUNTIME_WAVM;


@json
class BenchResult {
  language: string = "assemblyscript";
  description!: string;
  elapsed!: f64;
  bytes!: u64;
  operations!: u64;
  features!: string[];
  nsPerOp!: f64;
  mbps!: f64;
  gbps!: f64;
}

let result: BenchResult | null = null;

// 64KB per WebAssembly memory page
const WASM_PAGE_SIZE: usize = 64 * 1024;
// @ts-expect-error: BENCH_PREALLOC_BYTES may be undefined.
const PREALLOC_BYTES: usize = isDefined(BENCH_PREALLOC_BYTES) ? BENCH_PREALLOC_BYTES : 1 << 30; // 1GB
let preallocated = false;

// @ts-expect-error: @inline is a valid decorator
@inline function preallocateMemory(): void {
  if (preallocated) return;
  preallocated = true;
  if (PREALLOC_BYTES == 0) return;
  const currentPages = usize(memory.size());
  const targetPages: usize = (PREALLOC_BYTES + (WASM_PAGE_SIZE - 1)) / WASM_PAGE_SIZE;
  if (targetPages > currentPages) {
    // Ignore failure (memory.grow returns -1 on failure)
    memory.grow(i32(targetPages - currentPages));
  }
}

export function bench(description: string, routine: () => void, ops: u64 = 1_000_000, bytesPerOp: u64 = 0): void {
  preallocateMemory();
  // Run a full GC cycle before timing to reduce cross-bench noise.
  __collect();
  console.log(" - Benchmarking " + description);
  let warmup = ops / 10;
  while (--warmup) {
    routine();
  }

  const start = performance.now();

  let count = ops;
  while (count--) {
    routine();
  }

  const end = performance.now();
  const elapsed = Math.max(1, end - start);

  const opsPerSecond = f64(ops * 1000) / elapsed;
  const nsPerOp = (elapsed * 1_000_000) / f64(ops);

  let log = `   Completed benchmark in ${formatNumber(u64(Math.round(elapsed)))}ms at ${formatNumber(u64(Math.round(opsPerSecond)))} ops/s (${formatDurationPerOp(nsPerOp)})`;

  let mbPerSec: f64 = 0;
  if (bytesPerOp > 0) {
    const totalBytes = bytesPerOp * ops;
    mbPerSec = f64(totalBytes) / (elapsed / 1000) / (1000 * 1000);
    log += ` @ ${formatNumber(u64(Math.round(mbPerSec)))}MB/s`;
  }

  const features: string[] = [];
  if (ASC_FEATURE_SIMD) features.push("simd");

  result = {
    language: "assemblycript",
    description,
    elapsed,
    bytes: bytesPerOp,
    operations: ops,
    features,
    nsPerOp,
    mbps: mbPerSec,
    gbps: mbPerSec / 1000,
  };

  console.log(log + "\n");
}

function JSON_MODE_TO_STRING(mode: JSONMode): string {
  switch (mode) {
    case JSONMode.NAIVE:
      return "naive";
    case JSONMode.SIMD:
      return "simd";
    case JSONMode.SWAR:
      return "swar";
  }
  throw new Error("Unknown mode");
}

export function dumpToFile(suite: string, type: string): void {
  const suffix = BENCH_RUNTIME_WAVM ? ".wavm.json" : ".as.json";
  const fileName = "./build/logs/as/" + JSON_MODE_TO_STRING(JSON_MODE) + "/" + suite + "." + type + suffix;
  const json = JSON.stringify(result);
  if (BENCH_RUNTIME_STDOUT) {
    console.log("__AS_BENCH_JSON__" + fileName + "\t" + json);
    return;
  }
  writeFile(fileName, json);
}

export function readFile(path: string): string {
  if (BENCH_RUNTIME_STDOUT) throw new Error("readFile is not available in the WAVM/WASI benchmark runner: " + path);
  return String.UTF8.decode(readFileBuffer(path));
}

function formatNumber(n: u64): string {
  let str = n.toString();
  let len = str.length;
  let result = "";
  let commaOffset = len % 3;
  for (let i = 0; i < len; i++) {
    if (i > 0 && (i - commaOffset) % 3 == 0) result += ",";
    result += str.charAt(i);
  }
  return result;
}

function formatDecimal(n: f64, digits: u32): string {
  const scale = i64(Math.pow(10, f64(digits)));
  const rounded = i64(Math.round(n * f64(scale)));
  const whole = rounded / scale;
  let fraction = (rounded % scale).toString();
  while (u32(fraction.length) < digits) fraction = "0" + fraction;
  return whole.toString() + "." + fraction;
}

function formatDurationPerOp(nsPerOp: f64): string {
  if (nsPerOp >= 1000) return formatDecimal(nsPerOp / 1000, 2) + " us/op";
  return formatDecimal(nsPerOp, 2) + " ns/op";
}

const blackBoxArea = memory.data(64);
export function blackbox<T>(value: T): T {
  store<T>(blackBoxArea, value);
  return load<T>(blackBoxArea);
}
