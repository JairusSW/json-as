let result = {};
const printFn =
  typeof globalThis.print === "function"
    ? globalThis.print.bind(globalThis)
    : console.log.bind(console);

function writeFileCompat(path, data) {
  if (typeof globalThis.writeFile === "function") {
    return globalThis.writeFile(path, data);
  }
  throw new Error("writeFile is not available in this runtime");
}

function readFileCompat(path) {
  if (typeof globalThis.read === "function") {
    return globalThis.read(path);
  }
  throw new Error("read is not available in this runtime");
}

export function bench(description, routine, ops = 1_000_000, bytesPerOp = 0) {
  printFn(" - Benchmarking " + description);
  let warmup = Math.floor(ops / 10);
  while (warmup-- > 0) {
    routine();
  }
  const start = performance.now();
  let count = ops;
  while (count-- > 0) {
    routine();
  }
  const end = performance.now();
  const elapsed = Math.max(1, end - start);
  const opsPerSecond = (ops * 1000) / elapsed;
  const nsPerOp = (elapsed * 1_000_000) / ops;
  let log = `   Completed benchmark in ${formatNumber(Math.round(elapsed))}ms at ${formatNumber(Math.round(opsPerSecond))} ops/s (${formatDurationPerOp(nsPerOp)})`;
  let mbPerSec = 0;
  if (bytesPerOp > 0) {
    const totalBytes = bytesPerOp * ops;
    mbPerSec = totalBytes / (elapsed / 1000) / (1000 * 1000);
    log += ` @ ${formatNumber(Math.round(mbPerSec))}MB/s`;
  }
  result = {
    language: "javascript",
    description,
    elapsed,
    bytes: bytesPerOp,
    operations: ops,
    features: [],
    nsPerOp,
    mbps: mbPerSec,
  };
  printFn(log + "\n");
}
export function dumpToFile(suite, type) {
  writeFileCompat(
    "./build/logs/js/" + suite + "." + type + ".js.json",
    JSON.stringify(result),
  );
}

export function readFile(path) {
  return readFileCompat(path);
}

export function utf8ByteLength(value) {
  if (typeof Buffer !== "undefined") return Buffer.byteLength(value, "utf8");
  // d8 (the V8 shell these benches run in) has neither Buffer nor TextEncoder,
  // so count UTF-8 bytes from the UTF-16 code units directly.
  let len = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x80) len += 1;
    else if (c < 0x800) len += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < value.length) {
      const lo = value.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        len += 4; // surrogate pair -> one 4-byte code point
        i++;
        continue;
      }
      len += 3; // lone high surrogate
    } else len += 3;
  }
  return len;
}

function formatNumber(n) {
  let str = n.toString();
  let len = str.length;
  let result = "";
  let commaOffset = len % 3;
  for (let i = 0; i < len; i++) {
    if (i > 0 && (i - commaOffset) % 3 === 0) result += ",";
    result += str.charAt(i);
  }
  return result;
}

function formatDurationPerOp(nsPerOp) {
  if (nsPerOp >= 1000) return `${(nsPerOp / 1000).toFixed(2)} us/op`;
  return `${nsPerOp.toFixed(2)} ns/op`;
}

export function blackbox(x) {
  try {
    (0, eval)("%PerformMicrotaskCheckpoint();");
  } catch {
    // Not running in d8 with natives syntax enabled.
  }
  return x;
}
