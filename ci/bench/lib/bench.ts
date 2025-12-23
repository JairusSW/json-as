export function bench(description: string, routine: () => void, ops: number = 1_000_000, bytesPerOp: number = 0): void {
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

  if (bytesPerOp > 0) {
    const totalBytes = bytesPerOp * ops;
    const mbPerSec = totalBytes / (elapsed / 1000) / (1000 * 1000);
    log += ` @ ${formatNumber(Math.round(mbPerSec))}MB/s`;
  }

  console.log(log + "\n");
}

function formatNumber(n: number): string {
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
