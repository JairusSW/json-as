import { bs } from "../../../lib/as-bs";
import { expect } from "../../__tests__/lib";
import { deserializeStringField_SWAR as deserializeStringField_SWAR_Baseline } from "../../deserialize/swar/string";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { DESERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { hex4_to_u16_swar } from "../../util/swar";
import { bench, blackbox, dumpToFile } from "../lib/bench";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { __heap_base } from "memory";

// Head-to-head comparison: 8-byte stride (production) vs 16-byte wide-scan
// vs 16-byte stride with inline processing. Focus is the no-escape hot path
// where most fields are spent.

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

// @ts-expect-error: @inline is a valid decorator
@inline function bsq_mask(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  const q = block ^ 0x0022_0022_0022_0022;
  return (
    (((q - 0x0001_0001_0001_0001) & ~q) | ((b - 0x0001_0001_0001_0001) & ~b)) &
    0x0080_0080_0080_0080
  );
}

// @ts-expect-error: @inline is a valid decorator
@inline function processEscapedScan(
  payloadStart: usize,
  escapeStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  const prefixLen = <u32>(escapeStart - payloadStart);
  const srcEnd8 = srcEnd - 8;
  bs.offset = bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart));
  if (prefixLen != 0) {
    memory.copy(bs.buffer, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let lastPtr = escapeStart;
  let srcStart = escapeStart;

  while (srcStart <= srcEnd8) {
    const blockStart = srcStart;
    let mask = inline.always(bsq_mask(load<u64>(srcStart)));
    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const char = load<u16>(srcIdx);
      if (char == QUOTE) {
        const runLen = <u32>(srcIdx - lastPtr);
        if (runLen != 0) {
          memory.copy(bs.offset, lastPtr, runLen);
          bs.offset += runLen;
        }
        writeStringToField(
          dstFieldPtr,
          bs.buffer,
          <u32>(bs.offset - bs.buffer),
        );
        bs.offset = bs.buffer;
        return srcIdx + 2;
      }
      if (char != BACK_SLASH) continue;

      const runLen = <u32>(srcIdx - lastPtr);
      if (runLen != 0) {
        memory.copy(bs.offset, lastPtr, runLen);
        bs.offset += runLen;
      }

      const chunk = load<u32>(srcIdx);
      const code = <u16>(chunk >> 16);
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
      break;
    } while (mask !== 0);
    if (srcStart == blockStart) srcStart += 8;
  }

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

// --- Candidate OLD: pre-optimization 8-byte stride (verbatim copy of the
// production implementation prior to the WideScan16 change). Lives in this
// bench file so we can compare it against current production in a single
// process without process-boundary noise.

function fieldDeser_OLD(
  srcStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE)
    abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  const srcEnd8 = srcEnd - 8;
  srcStart = payloadStart;

  while (srcStart <= srcEnd8) {
    let mask = inline.always(bsq_mask(load<u64>(srcStart)));
    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
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
      if (char != BACK_SLASH) continue;
      return inline.always(
        processEscapedScan(payloadStart, srcIdx, srcEnd, dstFieldPtr),
      );
    } while (mask !== 0);

    srcStart += 8;
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
        processEscapedScan(payloadStart, srcStart, srcEnd, dstFieldPtr),
      );
    }
    srcStart += 2;
  }

  abort("Unterminated string literal");
  return srcStart;
}

// --- Candidate NEW: current production (WideScan16). Dispatched via the
// real export so any future tuning of the production impl is reflected here.

function fieldDeser_NEW(
  srcStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  return deserializeStringField_SWAR_Baseline<string>(
    srcStart,
    srcEnd,
    dstFieldPtr,
  );
}

// --- Candidate SHORT: WideScan16 + scalar fast-path for tiny payloads.
// For payload byte-length < 16, skip SWAR setup entirely and scalar-scan.
// Branch is well-predicted in real JSON (short fields dominate or long
// fields dominate; mixed workloads pay one mispredict per phase).

function fieldDeser_SHORT(
  srcStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE)
    abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  srcStart = payloadStart;

  // Scalar fast-path for payloads < 8 chars (16 bytes). Skips the entire
  // SWAR pipeline (wide-scan setup, 8-byte loop entry, srcEnd8 compute).
  if (srcEnd - payloadStart < 16) {
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
          processEscapedScan(payloadStart, srcStart, srcEnd, dstFieldPtr),
        );
      }
      srcStart += 2;
    }
    abort("Unterminated string literal");
    return srcStart;
  }

  // Wide pre-scan: skip 16 bytes per iter while both halves are clean.
  const srcEnd16 = srcEnd - 16;
  while (srcStart <= srcEnd16) {
    const m0 = inline.always(bsq_mask(load<u64>(srcStart)));
    const m1 = inline.always(bsq_mask(load<u64>(srcStart, 8)));
    if ((m0 | m1) != 0) break;
    srcStart += 16;
  }

  const srcEnd8 = srcEnd - 8;
  while (srcStart <= srcEnd8) {
    let mask = inline.always(bsq_mask(load<u64>(srcStart)));
    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
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
      if (char != BACK_SLASH) continue;
      return inline.always(
        processEscapedScan(payloadStart, srcIdx, srcEnd, dstFieldPtr),
      );
    } while (mask !== 0);

    srcStart += 8;
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
        processEscapedScan(payloadStart, srcStart, srcEnd, dstFieldPtr),
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
const ESCAPED_BASE = "ab\\\\ncd\\\\tEFG\\\\u0041HIJ\\\\u263A\\\\\\\\KLM";

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

// Ops counts tuned so each bench runs ~5s wall-time at the NEW (faster)
// speed measured on a prior run. The OLD variant will run a bit longer.
// Includes very-small payloads (8-32 bytes) to expose where the SHORT
// candidate's scalar fast-path is supposed to pay off.
const SIZES_PLAIN: usize[] = [
  8,
  16,
  32,
  64,
  256,
  1024,
  4 * 1024,
  16 * 1024,
  64 * 1024,
  256 * 1024,
  1024 * 1024,
  5 * 1024 * 1024,
];
const LABELS_PLAIN: string[] = [
  "8b",
  "16b",
  "32b",
  "64b",
  "256b",
  "1kb",
  "4kb",
  "16kb",
  "64kb",
  "256kb",
  "1mb",
  "5mb",
];
const OPS_PLAIN: u64[] = [
  400_000_000, 350_000_000, 300_000_000, 250_000_000, 200_000_000, 60_000_000,
  18_000_000, 4_500_000, 1_200_000, 280_000, 20_000, 13_000,
];

const SIZES_ESCAPED: usize[] = [1024, 64 * 1024, 1024 * 1024];
const LABELS_ESCAPED: string[] = ["1kb", "64kb", "1mb"];
const OPS_ESCAPED: u64[] = [7_000_000, 110_000, 7_000];

// Build and verify all corpora before timing.
const plainCorpus = new Array<string>(SIZES_PLAIN.length);
const escapedCorpus = new Array<string>(SIZES_ESCAPED.length);

for (let i = 0; i < SIZES_PLAIN.length; i++) {
  unchecked((plainCorpus[i] = makePlainJsonString(unchecked(SIZES_PLAIN[i]))));
}
for (let i = 0; i < SIZES_ESCAPED.length; i++) {
  unchecked(
    (escapedCorpus[i] = makeEscapedJsonString(unchecked(SIZES_ESCAPED[i]))),
  );
}

// Module-level state for the closure-free bench routines.
let CUR_PTR: usize = 0;
let CUR_END: usize = 0;
let CUR_SLOT: usize = 0;
const slotHolder = new Array<string>(1);

function bench_OLD(): void {
  blackbox(fieldDeser_OLD(CUR_PTR, CUR_END, CUR_SLOT));
}
function bench_NEW(): void {
  blackbox(fieldDeser_NEW(CUR_PTR, CUR_END, CUR_SLOT));
}
function bench_SHORT(): void {
  blackbox(fieldDeser_SHORT(CUR_PTR, CUR_END, CUR_SLOT));
}

// Cross-variant equivalence check on each payload.
const tmpA = new Array<string>(1);
const tmpB = new Array<string>(1);
const tmpC = new Array<string>(1);
for (let i = 0; i < plainCorpus.length; i++) {
  const v = unchecked(plainCorpus[i]);
  const ptr = changetype<usize>(v);
  const end = ptr + (v.length << 1);
  blackbox(fieldDeser_OLD(ptr, end, tmpA.dataStart));
  blackbox(fieldDeser_NEW(ptr, end, tmpB.dataStart));
  blackbox(fieldDeser_SHORT(ptr, end, tmpC.dataStart));
  expect(unchecked(tmpA[0])).toBe(unchecked(tmpB[0]));
  expect(unchecked(tmpA[0])).toBe(unchecked(tmpC[0]));
}
for (let i = 0; i < escapedCorpus.length; i++) {
  const v = unchecked(escapedCorpus[i]);
  const ptr = changetype<usize>(v);
  const end = ptr + (v.length << 1);
  blackbox(fieldDeser_OLD(ptr, end, tmpA.dataStart));
  blackbox(fieldDeser_NEW(ptr, end, tmpB.dataStart));
  blackbox(fieldDeser_SHORT(ptr, end, tmpC.dataStart));
  expect(unchecked(tmpA[0])).toBe(unchecked(tmpB[0]));
  expect(unchecked(tmpA[0])).toBe(unchecked(tmpC[0]));
}

CUR_SLOT = slotHolder.dataStart;

for (let i = 0; i < SIZES_PLAIN.length; i++) {
  const label = unchecked(LABELS_PLAIN[i]);
  const value = unchecked(plainCorpus[i]);
  const ops = unchecked(OPS_PLAIN[i]);
  const bytes = String.UTF8.byteLength(value);
  CUR_PTR = changetype<usize>(value);
  CUR_END = CUR_PTR + (value.length << 1);

  bench("Field SWAR OLD Plain (" + label + ")", bench_OLD, ops, bytes);
  dumpToFile("swar-string-deser-h2h-old-plain-" + label, "deserialize");

  bench("Field SWAR NEW Plain (" + label + ")", bench_NEW, ops, bytes);
  dumpToFile("swar-string-deser-h2h-new-plain-" + label, "deserialize");

  bench("Field SWAR SHORT Plain (" + label + ")", bench_SHORT, ops, bytes);
  dumpToFile("swar-string-deser-h2h-short-plain-" + label, "deserialize");
}

for (let i = 0; i < SIZES_ESCAPED.length; i++) {
  const label = unchecked(LABELS_ESCAPED[i]);
  const value = unchecked(escapedCorpus[i]);
  const ops = unchecked(OPS_ESCAPED[i]);
  const bytes = String.UTF8.byteLength(value);
  CUR_PTR = changetype<usize>(value);
  CUR_END = CUR_PTR + (value.length << 1);

  bench("Field SWAR OLD Escaped (" + label + ")", bench_OLD, ops, bytes);
  dumpToFile("swar-string-deser-h2h-old-escaped-" + label, "deserialize");

  bench("Field SWAR NEW Escaped (" + label + ")", bench_NEW, ops, bytes);
  dumpToFile("swar-string-deser-h2h-new-escaped-" + label, "deserialize");

  bench("Field SWAR SHORT Escaped (" + label + ")", bench_SHORT, ops, bytes);
  dumpToFile("swar-string-deser-h2h-short-escaped-" + label, "deserialize");
}
