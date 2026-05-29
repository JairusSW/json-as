// Head-to-head: existing `deserializeFloat_NAIVE<f64>` (digit-by-digit
// accumulator + per-fraction fdiv) vs Lemire-lite `parseFloatFast`
// (single u64 mantissa + one exact pow10 multiply).
//
// The bench feeds each parser identical batches of float strings at
// various shapes: integer-shaped, short fraction, long fraction with
// exponent, etc. Reports MB/s per (UTF-16 bytes scanned).

import { bench, blackbox, dumpToFile } from "../lib/bench";
import { deserializeFloat_NAIVE } from "../../deserialize/naive/float";
import { parseFloatFast } from "../../util/parsefloat-fast";

// Build a corpus: each entry is a NUL-terminated UTF-16 view stored in a
// shared scratch buffer. We track (ptr, end) pairs in two parallel u32
// arrays.

class Corpus {
  ptrs: StaticArray<usize>;
  ends: StaticArray<usize>;
  totalBytes: u64;

  constructor(
    public name: string,
    public values: string[],
  ) {
    const n = values.length;
    this.ptrs = new StaticArray<usize>(n);
    this.ends = new StaticArray<usize>(n);
    let total: u64 = 0;
    for (let i = 0; i < n; i++) {
      const s = values[i];
      const start = changetype<usize>(s);
      const len = (<usize>s.length) << 1;
      this.ptrs[i] = start;
      this.ends[i] = start + len;
      total += <u64>len;
    }
    this.totalBytes = total;
  }
}

function cyc(base: string[], count: i32): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(base[i % base.length]);
  return out;
}

const COUNT: i32 = 100_000;

const corpora: Corpus[] = [
  new Corpus(
    "integer-shaped (e.g. 0, 1000, 99999)",
    cyc(["0", "1", "42", "1234", "99999"], COUNT),
  ),
  new Corpus(
    "short fraction (e.g. 1.5, 3.14, 0.125)",
    cyc(["1.5", "3.14", "0.125", "-2.25", "7.23"], COUNT),
  ),
  new Corpus(
    "medium fraction (e.g. 3.141592653589793)",
    cyc(
      ["3.141592653589793", "-123456789.25", "1.41421356237", "2.718281828459"],
      COUNT,
    ),
  ),
  new Corpus(
    "exponent forms (e.g. 1e-7, 6.022e23)",
    cyc(["1e-7", "6.022e23", "3.14e5", "-9.81e+2", "1e10"], COUNT),
  ),
];

// Scratch for the bench loops.
let CUR_PTRS: usize = 0;
let CUR_ENDS: usize = 0;
let CUR_N: i32 = 0;
let CUR_BYTES: u64 = 0;

function runStd(): void {
  let acc: f64 = 0;
  for (let i = 0; i < CUR_N; i++) {
    const start = load<usize>(CUR_PTRS + ((<usize>i) << alignof<usize>()));
    const end = load<usize>(CUR_ENDS + ((<usize>i) << alignof<usize>()));
    acc += deserializeFloat_NAIVE<f64>(start, end);
  }
  blackbox(acc);
}

function runFast(): void {
  let acc: f64 = 0;
  for (let i = 0; i < CUR_N; i++) {
    const start = load<usize>(CUR_PTRS + ((<usize>i) << alignof<usize>()));
    const end = load<usize>(CUR_ENDS + ((<usize>i) << alignof<usize>()));
    acc += parseFloatFast<f64>(start, end);
  }
  blackbox(acc);
}

const OPS: u64 = 200;
for (let i = 0; i < corpora.length; i++) {
  const c = corpora[i];
  CUR_PTRS = changetype<usize>(c.ptrs);
  CUR_ENDS = changetype<usize>(c.ends);
  CUR_N = c.values.length;
  CUR_BYTES = c.totalBytes;

  bench("parseFloat STD f64 [" + c.name + "]", runStd, OPS, CUR_BYTES);
  dumpToFile("parsefloat-h2h-std-f64-" + i.toString(), "parse");

  bench("parseFloat NEW f64 [" + c.name + "]", runFast, OPS, CUR_BYTES);
  dumpToFile("parsefloat-h2h-new-f64-" + i.toString(), "parse");
}
