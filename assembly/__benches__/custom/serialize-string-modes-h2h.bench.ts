import { bs } from "../../../lib/as-bs";
import { serializeString_NAIVE } from "../../serialize/naive/string";
import { serializeString_SWAR } from "../../serialize/swar/string";
import { serializeString_SIMD } from "../../serialize/simd/string";
import { bench, blackbox, dumpToFile } from "../lib/bench";

// Serialize landscape: NAIVE (run-copy) vs SWAR/SIMD (streaming) across escape
// densities. If SWAR/SIMD dominate NAIVE everywhere (esp. sparse), the
// streaming escape loop is already optimal and a bulk-copy variant won't help.
// If NAIVE's run-copy wins sparse, there's a bulk opportunity worth pursuing.
// bs is reset each iteration so we measure pure serialize throughput.

// Raw string VALUES (serialize adds the surrounding quotes + escapes).
const BASE_PLAIN =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 the quick brown fox";
const BASE_DENSE = 'ab\ncd\tEF"GH\\IJ\nK';
const BASE_MODERATE =
  'the quick brown fox \n jumps over \t the lazy " dog \\ end';
const BASE_SPARSE =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 the quick brown fox jumps over the lazy dog padding padding pad \n";

function make(base: string, targetBytes: i32): string {
  const targetLen = targetBytes >> 1;
  let s = "";
  while (s.length < targetLen) s += base;
  return s.slice(0, targetLen);
}

const SIZES: i32[] = [256, 4 * 1024, 64 * 1024, 1024 * 1024];
const LABELS: string[] = ["256b", "4kb", "64kb", "1mb"];
const OPS: u64[] = [20_000_000, 2_000_000, 120_000, 7_000];
const PROFILES: string[] = ["plain", "dense", "moderate", "sparse"];
const BASES: string[] = [BASE_PLAIN, BASE_DENSE, BASE_MODERATE, BASE_SPARSE];

const corpora = new Array<Array<string>>(PROFILES.length);
for (let p = 0; p < PROFILES.length; p++) {
  const arr = new Array<string>(SIZES.length);
  for (let i = 0; i < SIZES.length; i++) {
    unchecked((arr[i] = make(unchecked(BASES[p]), i32(unchecked(SIZES[i])))));
  }
  unchecked((corpora[p] = arr));
}

let CUR: string = "";

// Reset bs scratch before each call so no per-op allocation / unbounded growth.
function bench_NAIVE(): void {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  serializeString_NAIVE(CUR);
  blackbox(bs.offset);
}
function bench_SWAR(): void {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  serializeString_SWAR(CUR);
  blackbox(bs.offset);
}
function bench_SIMD(): void {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  serializeString_SIMD(CUR);
  blackbox(bs.offset);
}

for (let p = 0; p < PROFILES.length; p++) {
  const tag = unchecked(PROFILES[p]);
  const arr = unchecked(corpora[p]);
  for (let i = 0; i < SIZES.length; i++) {
    const label = unchecked(LABELS[i]);
    const value = unchecked(arr[i]);
    const op = unchecked(OPS[i]);
    const bytes = String.UTF8.byteLength(value);
    CUR = value;

    bench(
      "Serialize NAIVE " + tag + " (" + label + ")",
      bench_NAIVE,
      op,
      bytes,
    );
    dumpToFile(
      "serialize-string-modes-naive-" + tag + "-" + label,
      "serialize",
    );
    bench("Serialize SWAR " + tag + " (" + label + ")", bench_SWAR, op, bytes);
    dumpToFile("serialize-string-modes-swar-" + tag + "-" + label, "serialize");
    bench("Serialize SIMD " + tag + " (" + label + ")", bench_SIMD, op, bytes);
    dumpToFile("serialize-string-modes-simd-" + tag + "-" + label, "serialize");
  }
}
