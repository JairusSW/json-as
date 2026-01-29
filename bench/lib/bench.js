let result = {};
export function bench(description, routine, ops = 1_000_000, bytesPerOp = 0) {
  console.log(" - Benchmarking " + description);
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
  let log = `   Completed benchmark in ${formatNumber(Math.round(elapsed))}ms at ${formatNumber(Math.round(opsPerSecond))} ops/s`;
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
    mbps: mbPerSec,
  };
  console.log(log + "\n");
}
export function dumpToFile(suite, type) {
  writeFile("./build/logs/js/" + suite + "." + type + ".js.json", JSON.stringify(result));
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

export function blackbox(x) {
  %PerformMicrotaskCheckpoint();
  return x;
}
