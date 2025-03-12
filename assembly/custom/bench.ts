export function bench(description: string, routine: () => void, ops: u64 = 1_000_000): void {
  console.log(" - Benchmarking " + description);
  const start = Date.now();
  let count = ops;
  while (count != 0) {
    routine();
    count--;
  }
  const elapsed = Date.now() - start;

  let opsPerSecond = (ops * 1000) / elapsed;

  console.log(`   Completed benchmark in ${formatNumber(elapsed)}ms at ${formatNumber(opsPerSecond)} ops/s\n`);
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
