// Żmij float-writer throughput: SWAR vs SIMD kernels vs AS stdlib toString,
// plus the full json-as JSON.stringify<f64/f32> path. Build with --enable simd
// (run-bench --mode simd) so the v128 kernels are exercised; forceSwarBackend
// toggles the register-parallel path inside the same binary.
import { JSON } from "../..";
import { bench, dumpToFile, blackbox } from "../lib/bench";
import {
  writeDoubleUnsafe,
  writeFloatUnsafe,
  forceSwarBackend,
} from "../../util/zmij";

// A spread of magnitudes: small ints, fractions, exponential extremes.
const D: f64[] = [
  6.62607015e-34, 5.444310685350916e14, 3.439070283483335e35, 1.0, 43210.1,
  -5942736479622170.0, 2.2250738585072004e-308, 0.0001220703125,
  1.3076622631878654e65, 9.03725590277404e159, 0.5, 123456.789,
  -1.2345678901234567e123, 2.9802322387695312e-8, 100.0, 0.1,
];
const F: f32[] = [
  3.14159, 0.5, 1.0, 43210.1, 1e20, 1e-7, 100.0, 0.1, 16777216.0, 1.25, -3.5,
  2.5, 0.0001, 9.999999e9, 123.4567, -0.0625,
];
const ND = D.length;
const NF = F.length;
const SCRATCH = memory.data(128);

forceSwarBackend(true);
bench(
  "zmij-dtoa-swar",
  () => {
    for (let i = 0; i < ND; i++)
      blackbox<usize>(writeDoubleUnsafe(SCRATCH, unchecked(D[i])));
  },
  200_000,
  <u64>ND,
);
dumpToFile("dtoa-swar", "serialize");

forceSwarBackend(false);
bench(
  "zmij-dtoa-simd",
  () => {
    for (let i = 0; i < ND; i++)
      blackbox<usize>(writeDoubleUnsafe(SCRATCH, unchecked(D[i])));
  },
  200_000,
  <u64>ND,
);
dumpToFile("dtoa-simd", "serialize");

bench(
  "stdlib-dtoa",
  () => {
    for (let i = 0; i < ND; i++)
      blackbox<i32>(unchecked(D[i]).toString().length);
  },
  200_000,
  <u64>ND,
);
dumpToFile("dtoa-stdlib", "serialize");

forceSwarBackend(true);
bench(
  "zmij-ftoa-swar",
  () => {
    for (let i = 0; i < NF; i++)
      blackbox<usize>(writeFloatUnsafe(SCRATCH, unchecked(F[i])));
  },
  200_000,
  <u64>NF,
);
dumpToFile("ftoa-swar", "serialize");

forceSwarBackend(false);
bench(
  "zmij-ftoa-simd",
  () => {
    for (let i = 0; i < NF; i++)
      blackbox<usize>(writeFloatUnsafe(SCRATCH, unchecked(F[i])));
  },
  200_000,
  <u64>NF,
);
dumpToFile("ftoa-simd", "serialize");

// Full json-as public path (allocates the result string).
bench(
  "json-stringify-f64",
  () => {
    for (let i = 0; i < ND; i++)
      blackbox<string>(JSON.stringify<f64>(unchecked(D[i])));
  },
  200_000,
  <u64>ND,
);
dumpToFile("stringify-f64", "serialize");
