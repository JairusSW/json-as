import { bs } from "../../../lib/as-bs";
import { expect } from "../../__tests__/lib";
import { deserializeStringField_SIMD } from "../../deserialize/simd/string";
import { deserializeStringField_SWAR } from "../../deserialize/swar/string";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { DESERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { hex4_to_u16_swar } from "../../util/swar";
import { bench, blackbox, dumpToFile } from "../lib/bench";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { __heap_base } from "memory";

// Scratch-space head-to-head for the SIMD string FIELD deserializer.
//
// BASELINE = production `deserializeStringField_SIMD`, which vectorizes the
// no-escape scan but BAILS to the scalar/SWAR `deserializeStringField_SWAR`
// the moment it sees a backslash — so SIMD mode gets zero vectorization on any
// escaped field.
//
// NEW = a fully vectorized field scanner: v128 scan for `"`/`\`, copy the
// runs between escapes into the reused `bs` scratch buffer, decode each escape
// scalar, then one final `writeStringToField`. The destination is a reused
// field slot (`slotHolder.dataStart`) so after warmup there is no per-op
// allocation — pure scan+copy throughput, playground-style.

// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_5C = i16x8.splat(0x5c); // \
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_22 = i16x8.splat(0x22); // "

// @ts-expect-error: @inline is a valid decorator
@inline function writeStringToField(
  dstFieldPtr: usize,
  srcStart: usize,
  byteLength: u32,
): void {
  if (byteLength == 0) {
    store<usize>(dstFieldPtr, changetype<usize>(""));
    return;
  }
  const current = load<usize>(dstFieldPtr);
  let stringPtr: usize;
  if (current >= __heap_base) {
    if (changetype<OBJECT>(current - TOTAL_OVERHEAD).rtSize == byteLength) {
      stringPtr = current;
    } else {
      stringPtr = __renew(current, byteLength);
      store<usize>(dstFieldPtr, stringPtr);
    }
  } else {
    stringPtr = __new(byteLength, idof<string>());
    store<usize>(dstFieldPtr, stringPtr);
  }
  memory.copy(stringPtr, srcStart, byteLength);
}

// Vectorized escaped scanner for the field path. `escapeStart` points at the
// first `\` found by the caller's v128 scan. Copies runs between escapes into
// `bs` scratch, decodes escapes scalar, terminates on the closing `"`.
// @ts-expect-error: @inline is a valid decorator
@inline function deserializeEscapedField_SIMD_NEW(
  payloadStart: usize,
  escapeStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  const prefixLen = <u32>(escapeStart - payloadStart);
  bs.offset = bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart));
  if (prefixLen != 0) {
    memory.copy(bs.buffer, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let lastPtr = escapeStart;
  let srcStart = escapeStart;
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;

  while (srcStart <= srcEnd16) {
    const block = load<v128>(srcStart);
    const mask = i16x8.bitmask(
      v128.or(i16x8.eq(block, SPLAT_5C), i16x8.eq(block, SPLAT_22)),
    );
    if (mask == 0) {
      srcStart += 16;
      continue;
    }

    const laneIdx = usize(ctz(mask) << 1);
    const srcIdx = srcStart + laneIdx;
    const runLen = <u32>(srcIdx - lastPtr);
    if (runLen != 0) {
      memory.copy(bs.offset, lastPtr, runLen);
      bs.offset += runLen;
    }

    const char = load<u16>(srcIdx);
    if (char == QUOTE) {
      writeStringToField(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
      bs.offset = bs.buffer;
      return srcIdx + 2;
    }

    // backslash
    const code = load<u16>(srcIdx, 2);
    if (code !== 0x75) {
      store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
      bs.offset += 2;
      lastPtr = srcIdx + 4;
    } else {
      store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcIdx, 4)));
      bs.offset += 2;
      lastPtr = srcIdx + 12;
    }
    srcStart = lastPtr;
  }

  // scalar tail (< 16 bytes remaining)
  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      const runLen = <u32>(srcStart - lastPtr);
      if (runLen != 0) {
        memory.copy(bs.offset, lastPtr, runLen);
        bs.offset += runLen;
      }
      writeStringToField(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
      bs.offset = bs.buffer;
      return srcStart + 2;
    }
    if (char != BACK_SLASH) {
      srcStart += 2;
      continue;
    }

    const runLen = <u32>(srcStart - lastPtr);
    if (runLen != 0) {
      memory.copy(bs.offset, lastPtr, runLen);
      bs.offset += runLen;
    }

    const code = load<u16>(srcStart, 2);
    if (code !== 0x75) {
      store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
      bs.offset += 2;
      srcStart += 4;
    } else {
      store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcStart, 4)));
      bs.offset += 2;
      srcStart += 12;
    }
    lastPtr = srcStart;
  }

  bs.offset = bs.buffer;
  abort("Unterminated string literal");
  return srcStart;
}

// --- Candidate BASELINE: current production (SWAR fallback on escapes).
function fieldDeser_BASELINE(
  srcStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  return deserializeStringField_SIMD<string>(srcStart, srcEnd, dstFieldPtr);
}

// --- Candidate NEW: fully vectorized field scanner.
function fieldDeser_NEW(
  srcStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE)
    abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  srcStart = payloadStart;
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;

  while (srcStart <= srcEnd16) {
    const block = load<v128>(srcStart);
    const mask = i16x8.bitmask(
      v128.or(i16x8.eq(block, SPLAT_5C), i16x8.eq(block, SPLAT_22)),
    );
    if (mask == 0) {
      srcStart += 16;
      continue;
    }

    const laneIdx = usize(ctz(mask) << 1);
    const srcIdx = srcStart + laneIdx;
    const char = load<u16>(srcIdx);
    if (char == QUOTE) {
      writeStringToField(
        dstFieldPtr,
        payloadStart,
        <u32>(srcIdx - payloadStart),
      );
      return srcIdx + 2;
    }
    return inline.always(
      deserializeEscapedField_SIMD_NEW(
        payloadStart,
        srcIdx,
        srcEnd,
        dstFieldPtr,
      ),
    );
  }

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      writeStringToField(
        dstFieldPtr,
        payloadStart,
        <u32>(srcStart - payloadStart),
      );
      return srcStart + 2;
    }
    if (char == BACK_SLASH) {
      return inline.always(
        deserializeEscapedField_SIMD_NEW(
          payloadStart,
          srcStart,
          srcEnd,
          dstFieldPtr,
        ),
      );
    }
    srcStart += 2;
  }

  abort("Unterminated string literal");
  return srcStart;
}

// --- Corpus construction ---

const PLAIN_BASE =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890`~!@#$%^&*()-_=+[]{}|;:,.<>/? ";
// Mixed escape density: short escapes, \uXXXX, and runs of plain text.
const ESCAPED_BASE =
  "ab\\\\ncd\\\\tEFG\\\\u0041HIJ\\\\u263A\\\\\\\\KLMplaintextrun";

function makePlainJsonString(targetBytes: usize): string {
  const targetLen = targetBytes >> 1;
  const repeats = i32((targetLen + PLAIN_BASE.length - 1) / PLAIN_BASE.length);
  const payload = PLAIN_BASE.repeat(repeats).slice(0, i32(targetLen));
  return `"${payload}"`;
}

function makeEscapedJsonString(targetBytes: usize): string {
  const targetLen = targetBytes >> 1;
  const repeats = i32(
    (targetLen + ESCAPED_BASE.length - 1) / ESCAPED_BASE.length,
  );
  const payload = ESCAPED_BASE.repeat(repeats);
  return `"${payload}"`;
}

// Profile 1: plain-short (object-key/value-sized fields, no escapes).
const SIZES_SHORT: usize[] = [8, 16, 32, 64, 256];
const LABELS_SHORT: string[] = ["8b", "16b", "32b", "64b", "256b"];
const OPS_SHORT: u64[] = [
  300_000_000, 280_000_000, 240_000_000, 200_000_000, 80_000_000,
];

// Profile 2: plain-large (big ASCII payloads, no escapes — memcpy-bound).
const SIZES_LARGE: usize[] = [
  4 * 1024,
  64 * 1024,
  1024 * 1024,
  5 * 1024 * 1024,
];
const LABELS_LARGE: string[] = ["4kb", "64kb", "1mb", "5mb"];
const OPS_LARGE: u64[] = [12_000_000, 900_000, 50_000, 9_000];

// Profile 3: escaped (the path NEW targets — BASELINE falls back to SWAR).
const SIZES_ESCAPED: usize[] = [256, 1024, 64 * 1024, 1024 * 1024];
const LABELS_ESCAPED: string[] = ["256b", "1kb", "64kb", "1mb"];
const OPS_ESCAPED: u64[] = [40_000_000, 11_000_000, 160_000, 9_000];

const shortCorpus = new Array<string>(SIZES_SHORT.length);
const largeCorpus = new Array<string>(SIZES_LARGE.length);
const escapedCorpus = new Array<string>(SIZES_ESCAPED.length);

for (let i = 0; i < SIZES_SHORT.length; i++) {
  unchecked((shortCorpus[i] = makePlainJsonString(unchecked(SIZES_SHORT[i]))));
}
for (let i = 0; i < SIZES_LARGE.length; i++) {
  unchecked((largeCorpus[i] = makePlainJsonString(unchecked(SIZES_LARGE[i]))));
}
for (let i = 0; i < SIZES_ESCAPED.length; i++) {
  unchecked(
    (escapedCorpus[i] = makeEscapedJsonString(unchecked(SIZES_ESCAPED[i]))),
  );
}

// Module-level state for closure-free bench routines.
let CUR_PTR: usize = 0;
let CUR_END: usize = 0;
let CUR_SLOT: usize = 0;
const slotHolder = new Array<string>(1);

function bench_BASELINE(): void {
  blackbox(fieldDeser_BASELINE(CUR_PTR, CUR_END, CUR_SLOT));
}
function bench_NEW(): void {
  blackbox(fieldDeser_NEW(CUR_PTR, CUR_END, CUR_SLOT));
}

// Cross-variant equivalence check (NEW vs BASELINE vs SWAR) on every payload.
const tmpA = new Array<string>(1);
const tmpB = new Array<string>(1);
const tmpC = new Array<string>(1);
function verifyCorpus(corpus: Array<string>): void {
  for (let i = 0; i < corpus.length; i++) {
    const v = unchecked(corpus[i]);
    const ptr = changetype<usize>(v);
    const end = ptr + (v.length << 1);
    blackbox(fieldDeser_BASELINE(ptr, end, tmpA.dataStart));
    blackbox(fieldDeser_NEW(ptr, end, tmpB.dataStart));
    blackbox(deserializeStringField_SWAR<string>(ptr, end, tmpC.dataStart));
    expect(unchecked(tmpA[0])).toBe(unchecked(tmpB[0]));
    expect(unchecked(tmpA[0])).toBe(unchecked(tmpC[0]));
  }
}
verifyCorpus(shortCorpus);
verifyCorpus(largeCorpus);
verifyCorpus(escapedCorpus);

CUR_SLOT = slotHolder.dataStart;

function runProfile(
  corpus: Array<string>,
  labels: string[],
  ops: u64[],
  tag: string,
): void {
  for (let i = 0; i < corpus.length; i++) {
    const label = unchecked(labels[i]);
    const value = unchecked(corpus[i]);
    const op = unchecked(ops[i]);
    const bytes = <u64>(value.length << 1);
    CUR_PTR = changetype<usize>(value);
    CUR_END = CUR_PTR + (value.length << 1);

    bench(
      "Field SIMD BASELINE " + tag + " (" + label + ")",
      bench_BASELINE,
      op,
      bytes,
    );
    dumpToFile(
      "simd-string-deser-scratch-h2h-baseline-" + tag + "-" + label,
      "deserialize",
    );

    bench("Field SIMD NEW " + tag + " (" + label + ")", bench_NEW, op, bytes);
    dumpToFile(
      "simd-string-deser-scratch-h2h-new-" + tag + "-" + label,
      "deserialize",
    );
  }
}

runProfile(shortCorpus, LABELS_SHORT, OPS_SHORT, "short");
runProfile(largeCorpus, LABELS_LARGE, OPS_LARGE, "large");
runProfile(escapedCorpus, LABELS_ESCAPED, OPS_ESCAPED, "escaped");
