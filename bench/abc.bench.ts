import { bench } from "./lib/bench.js";

const v1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const v2 = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"';

bench(
  "Serialize Alphabet",
  () => {
    blackbox(JSON.stringify(blackbox(v1)));
  },
  64_000_00,
  v1.length << 1,
);

bench(
  "Deserialize Alphabet",
  () => {
    blackbox(JSON.parse(blackbox(v2)));
  },
  64_000_00,
  v2.length << 1,
);

function blackbox<T>(value: T): T {
  (globalThis as any).__blackhole = value;
  return globalThis.__blackhole;
}
