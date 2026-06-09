// xjb float-writer throughput vs AS stdlib toString, plus the full json-as
// JSON.stringify<f64> path. Float serialization lives in the `xjb-as` package;
// json-as calls its dtoa_buffered/ftoa_buffered writers directly. The SWAR vs
// WASM-SIMD digit kernel is chosen at *compile time* inside xjb-as, so run this
// bench once per kernel via run-bench:
//   bench:as custom/dtoa-h2h --mode swar   (SWAR kernel)
//   bench:as custom/dtoa-h2h --mode simd   (WASM-SIMD kernel)
// dumpToFile already files results under build/logs/as/<mode>/, so each run
// lands in its own directory.
import { JSON } from "../..";
import { bench, dumpToFile, blackbox } from "../lib/bench";
import { dtoa_buffered, ftoa_buffered } from "xjb-as";

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

bench(
  "xjb-dtoa",
  () => {
    for (let i = 0; i < ND; i++)
      blackbox<u32>(dtoa_buffered(SCRATCH, unchecked(D[i])));
  },
  200_000,
  <u64>ND,
);
dumpToFile("dtoa", "serialize");

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

bench(
  "xjb-ftoa",
  () => {
    for (let i = 0; i < NF; i++)
      blackbox<u32>(ftoa_buffered(SCRATCH, unchecked(F[i])));
  },
  200_000,
  <u64>NF,
);
dumpToFile("ftoa", "serialize");

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
