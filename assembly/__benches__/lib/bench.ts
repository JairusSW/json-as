import { JSON, JSONMode } from "../..";
// @ts-ignore: decorator allowed
@external("env", "writeFile")
declare function writeFile(fileName: string, data: string): void;


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
export function bench(description: string, routine: () => void, ops: u64 = 1_000_000, bytesPerOp: u64 = 0): void {
  console.log(" - Benchmarking " + description);
  const memory_log_stride = ops / 10;
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
