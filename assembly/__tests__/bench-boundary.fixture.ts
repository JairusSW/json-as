import { bench } from "../__benches__/lib/bench";
let calls: i32 = 0;
function routine(): void {
  calls++;
  if (calls > 40) throw new Error("warmup made no progress");
}
export function run(ops: u64): i32 {
  calls = 0;
  bench("boundary", routine, ops);
  return calls;
}
