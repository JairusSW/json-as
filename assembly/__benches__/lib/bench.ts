export function bench(description: string, routine: () => void, ops: u64 = 1_000_000, bytesPerOp: u64 = 0): void {
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

  if (bytesPerOp > 0) {
    const totalBytes = bytesPerOp * ops;
    const mbPerSec = f64(totalBytes) / (elapsed / 1000) / (1000 * 1000);
    log += ` @ ${formatNumber(u64(Math.round(mbPerSec)))}MB/s`;
  }

  console.log(log + "\n");
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
