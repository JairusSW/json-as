import { JSON, JSONMode } from "../..";
// @ts-ignore: decorator allowed
@external("env", "writeFile")
export declare function writeFile(fileName: string, data: string): void;

// @ts-ignore: decorator allowed
@external("env", "readFile")
export declare function readFileBuffer(filePath: string): ArrayBuffer;


@json
class BenchResult {
  language: string = "assemblyscript";
  description!: string;
  elapsed!: f64;
  bytes!: u64;
  operations!: u64;
  features!: string[];
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

  let log = `   Completed benchmark in ${formatNumber(u64(Math.round(elapsed)))}ms at ${formatNumber(u64(Math.round(opsPerSecond)))} ops/s`;

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
  writeFile("./build/logs/as/" + JSON_MODE_TO_STRING(JSON_MODE) + "/" + suite + "." + type + ".as.json", JSON.stringify(result));
}

export function readFile(path: string): string {
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

const blackBoxArea = memory.data(64);
export function blackbox<T>(value: T): T {
  store<T>(blackBoxArea, value);
  return load<T>(blackBoxArea);
}
