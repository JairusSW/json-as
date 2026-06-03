import { bs } from "../../../lib/as-bs";
import { expect } from "../../__tests__/lib";
import { serializeString_NAIVE } from "../../serialize/naive/string";
import { serializeString_SWAR } from "../../serialize/swar/string";
import { serializeString_SIMD } from "../../serialize/simd/string";
import { bench, blackbox, dumpToFile } from "../lib/bench";

// (A) Safety/equivalence: hammer SIMD serialize (with its +42-byte overflow
// stores) against NAIVE (run-copy, bounded writes = ground truth) over a large
// battery of adversarial escape-dense / surrogate / boundary-length inputs. If
// the overflow ever corrupted the buffer, outputs would diverge.
// (B) Plain size sweep SWAR vs SIMD to locate the 1mb falloff.

function runToString(kind: i32, src: string): string {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  if (kind == 0) serializeString_NAIVE(src);
  else if (kind == 1) serializeString_SWAR(src);
  else serializeString_SIMD(src);
  const len = bs.offset - bs.buffer;
  const out = changetype<string>(__new(len, idof<string>()));
  memory.copy(changetype<usize>(out), bs.buffer, len);
  return out;
}

// Build adversarial strings: control chars / quote / backslash / surrogates at
// every position within a 16-unit (v128) window, plus escape-dense fills, plus
// lengths that straddle 16B and 1024B buffer-growth boundaries.
const ESC_CHARS: string[] = ["\n", "\t", '"', "\\", "\x01", "\x1f", "\x00"];

function buildAdversarial(): string[] {
  const out: string[] = [];
  // 1. single escape at each offset 0..40 in an ASCII field
  for (let pos = 0; pos < 40; pos++) {
    for (let e = 0; e < ESC_CHARS.length; e++) {
      let s = "";
      for (let i = 0; i < pos; i++) s += "a";
      s += unchecked(ESC_CHARS[e]);
      for (let i = 0; i < 30; i++) s += "b";
      out.push(s);
    }
  }
  // 2. escape-dense fills of many lengths (erodes buffer slack fastest)
  for (let len = 1; len <= 600; len += 7) {
    let s = "";
    while (s.length < len) s += '\n"\\\t\x01';
    out.push(s.slice(0, len));
  }
  // 3. lengths straddling the 1024B buffer boundary, dense escapes
  for (let len = 500; len <= 560; len++) {
    let s = "";
    while (s.length < len) s += "\x01";
    out.push(s.slice(0, len));
  }
  // 4. surrogate pairs (emoji) + unpaired surrogates interleaved with escapes
  out.push('a\u{1F680}b\nc\u{1F600}"d\\e');
  out.push("\u{1F680}\u{1F600}\u{1F4A9}\u{1F389}".repeat(50));
  // lone high surrogate (0xD800) followed by ascii — unpaired path
  out.push(
    "x" + String.fromCharCode(0xd800) + "\ny" + String.fromCharCode(0xdc00),
  );
  return out;
}

const corpus = buildAdversarial();
let mismatches = 0;
for (let i = 0; i < corpus.length; i++) {
  const s = unchecked(corpus[i]);
  const ref = runToString(0, s); // NAIVE = ground truth
  const swar = runToString(1, s);
  const simd = runToString(2, s);
  if (swar != ref) mismatches++;
  if (simd != ref) mismatches++;
  expect(swar).toBe(ref);
  expect(simd).toBe(ref);
}
console.log(
  " - Safety: " +
    corpus.length.toString() +
    " adversarial inputs, SWAR+SIMD vs NAIVE mismatches = " +
    mismatches.toString(),
);

// (B) Plain size sweep: SWAR vs SIMD, locate the 1mb falloff.
const SWEEP: i32[] = [
  64 * 1024,
  128 * 1024,
  256 * 1024,
  512 * 1024,
  1024 * 1024,
  2 * 1024 * 1024,
  4 * 1024 * 1024,
];
const SWEEP_LBL: string[] = [
  "64kb",
  "128kb",
  "256kb",
  "512kb",
  "1mb",
  "2mb",
  "4mb",
];
const SWEEP_OPS: u64[] = [120_000, 60_000, 30_000, 15_000, 7_000, 3_500, 1_700];
const PLAIN_BASE =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 the quick brown fox";

function makePlain(targetBytes: i32): string {
  const targetLen = targetBytes >> 1;
  let s = "";
  while (s.length < targetLen) s += PLAIN_BASE;
  return s.slice(0, targetLen);
}

let CUR: string = "";
function sweep_SWAR(): void {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  serializeString_SWAR(CUR);
  blackbox(bs.offset);
}
function sweep_SIMD(): void {
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  serializeString_SIMD(CUR);
  blackbox(bs.offset);
}

for (let i = 0; i < SWEEP.length; i++) {
  const lbl = unchecked(SWEEP_LBL[i]);
  CUR = makePlain(unchecked(SWEEP[i]));
  const bytes = String.UTF8.byteLength(CUR);
  const op = unchecked(SWEEP_OPS[i]);
  bench("Plain sweep SWAR (" + lbl + ")", sweep_SWAR, op, bytes);
  dumpToFile("serialize-string-safety-sweep-swar-" + lbl, "serialize");
  bench("Plain sweep SIMD (" + lbl + ")", sweep_SIMD, op, bytes);
  dumpToFile("serialize-string-safety-sweep-simd-" + lbl, "serialize");
}
