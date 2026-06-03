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

// Variant exploration for the SIMD escaped FIELD scanner. PROD (current
// production, run-copy) vs HYBRID (bulk-memcpy clean runs + cheap per-escape
// prefix) vs STREAM (optimistic block-copy, single-pass). The plain no-escape
// path is identical across all three; only the escaped scanner differs, so
// the corpora vary escape DENSITY to find where each strategy wins.

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

// --- HYBRID (adaptive): clean runs are bulk-copied via one memory.copy after
// a read-only v128 scan (bandwidth-optimal for long sparse runs), while the
// escape-containing block reuses STREAM's trick — one whole-block v128 store
// covers the plain prefix for free, then decode. Aims to dominate both PROD
// and pure STREAM: STREAM-cheap on dense, PROD-fast on large sparse.
// @ts-expect-error: @inline is a valid decorator
@inline function escScan_HYBRID(
  payloadStart: usize,
  escapeStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  const prefixLen = <u32>(escapeStart - payloadStart);
  bs.offset = bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart) + 16); // +16 slack for overcopy
  if (prefixLen != 0) {
    memory.copy(bs.buffer, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let srcStart = escapeStart;
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;

  while (srcStart <= srcEnd16) {
    const block = load<v128>(srcStart);
    const mask = i16x8.bitmask(
      v128.or(i16x8.eq(block, SPLAT_5C), i16x8.eq(block, SPLAT_22)),
    );
    if (mask == 0) {
      // Stream the first clean block cheaply (matches STREAM on short runs).
      store<v128>(bs.offset, block);
      bs.offset += 16;
      srcStart += 16;
      // If the run continues, switch to bulk-memcpy for the remainder
      // (bandwidth-optimal for long sparse runs — avoids STREAM's cliff).
      if (srcStart <= srcEnd16) {
        const b2 = load<v128>(srcStart);
        if (
          i16x8.bitmask(
            v128.or(i16x8.eq(b2, SPLAT_5C), i16x8.eq(b2, SPLAT_22)),
          ) == 0
        ) {
          const runStart = srcStart;
          srcStart += 16;
          while (srcStart <= srcEnd16) {
            const b3 = load<v128>(srcStart);
            if (
              i16x8.bitmask(
                v128.or(i16x8.eq(b3, SPLAT_5C), i16x8.eq(b3, SPLAT_22)),
              ) != 0
            )
              break;
            srcStart += 16;
          }
          const runLen = <u32>(srcStart - runStart);
          memory.copy(bs.offset, runStart, runLen);
          bs.offset += runLen;
        }
      }
      continue;
    }

    // escape/quote block: one whole-block store covers the plain prefix.
    store<v128>(bs.offset, block);
    const laneIdx = usize(ctz(mask) << 1);
    bs.offset += laneIdx;
    const srcIdx = srcStart + laneIdx;
    const char = load<u16>(srcIdx);
    if (char == QUOTE) {
      writeStringToField(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
      bs.offset = bs.buffer;
      return srcIdx + 2;
    }

    const code = load<u16>(srcIdx, 2);
    if (code !== 0x75) {
      store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
      bs.offset += 2;
      srcStart = srcIdx + 4;
    } else {
      store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcIdx, 4)));
      bs.offset += 2;
      srcStart = srcIdx + 12;
    }
  }

  // scalar tail: STREAM-style direct emit (nothing pending to flush).
  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      writeStringToField(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
      bs.offset = bs.buffer;
      return srcStart + 2;
    }
    if (char != BACK_SLASH) {
      store<u16>(bs.offset, char);
      bs.offset += 2;
      srcStart += 2;
      continue;
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
  }
  bs.offset = bs.buffer;
  abort("Unterminated string literal");
  return srcStart;
}

// --- STREAM: optimistically store each scanned block into the scratch buffer,
// then on an escape keep only the plain prefix and decode. Single pass over
// the data (read once, write once) — favors long plain runs between escapes.
// @ts-expect-error: @inline is a valid decorator
@inline function escScan_STREAM(
  payloadStart: usize,
  escapeStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  const prefixLen = <u32>(escapeStart - payloadStart);
  bs.offset = bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart) + 16); // +16 slack for overcopy
  if (prefixLen != 0) {
    memory.copy(bs.buffer, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let srcStart = escapeStart;
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;

  while (srcStart <= srcEnd16) {
    const block = load<v128>(srcStart);
    store<v128>(bs.offset, block); // optimistic copy
    const mask = i16x8.bitmask(
      v128.or(i16x8.eq(block, SPLAT_5C), i16x8.eq(block, SPLAT_22)),
    );
    if (mask == 0) {
      srcStart += 16;
      bs.offset += 16;
      continue;
    }

    const laneIdx = usize(ctz(mask) << 1);
    bs.offset += laneIdx; // keep plain prefix of this block
    const srcIdx = srcStart + laneIdx;
    const char = load<u16>(srcIdx);
    if (char == QUOTE) {
      writeStringToField(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
      bs.offset = bs.buffer;
      return srcIdx + 2;
    }

    const code = load<u16>(srcIdx, 2);
    if (code !== 0x75) {
      store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
      bs.offset += 2;
      srcStart = srcIdx + 4;
    } else {
      store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcIdx, 4)));
      bs.offset += 2;
      srcStart = srcIdx + 12;
    }
  }

  // scalar tail: emit chars directly (STREAM has no pending run).
  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      writeStringToField(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
      bs.offset = bs.buffer;
      return srcStart + 2;
    }
    if (char != BACK_SLASH) {
      store<u16>(bs.offset, char);
      bs.offset += 2;
      srcStart += 2;
      continue;
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
  }

  bs.offset = bs.buffer;
  abort("Unterminated string literal");
  return srcStart;
}

// Shared plain-scan entry; dispatches to one of the escaped scanners.
// kind: 0 = HYBRID, 1 = STREAM.
// @ts-expect-error: @inline is a valid decorator
@inline function fieldDeser(
  srcStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
  kind: i32,
): usize {
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE)
    abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;
  srcStart = payloadStart;

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
    return kind == 0
      ? escScan_HYBRID(payloadStart, srcIdx, srcEnd, dstFieldPtr)
      : escScan_STREAM(payloadStart, srcIdx, srcEnd, dstFieldPtr);
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
      return kind == 0
        ? escScan_HYBRID(payloadStart, srcStart, srcEnd, dstFieldPtr)
        : escScan_STREAM(payloadStart, srcStart, srcEnd, dstFieldPtr);
    }
    srcStart += 2;
  }

  abort("Unterminated string literal");
  return srcStart;
}

function fieldDeser_PROD(srcStart: usize, srcEnd: usize, dst: usize): usize {
  return deserializeStringField_SIMD<string>(srcStart, srcEnd, dst);
}
function fieldDeser_HYBRID(srcStart: usize, srcEnd: usize, dst: usize): usize {
  return fieldDeser(srcStart, srcEnd, dst, 0);
}
function fieldDeser_STREAM(srcStart: usize, srcEnd: usize, dst: usize): usize {
  return fieldDeser(srcStart, srcEnd, dst, 1);
}

// --- Corpus construction: vary escape density ---

// DENSE: ~1 escape every few chars.
const BASE_DENSE = "ab\\\\ncd\\\\tEF\\\\u0041G\\\\u263AH\\\\\\\\I";
// MODERATE: ~1 escape every ~20 chars.
const BASE_MODERATE =
  "the quick brown fox \\\\n jumps over \\\\t the lazy \\\\u0041 dog";
// SPARSE: ~1 escape every ~120 chars (long plain runs).
const BASE_SPARSE =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 the quick brown fox jumps over the lazy dog padding padding pad \\\\n";

function makeJsonString(base: string, targetBytes: usize): string {
  const targetLen = targetBytes >> 1;
  const repeats = i32((targetLen + base.length - 1) / base.length);
  return `"${base.repeat(repeats)}"`;
}

const SIZES: usize[] = [256, 1024, 64 * 1024, 1024 * 1024];
const LABELS: string[] = ["256b", "1kb", "64kb", "1mb"];
const OPS: u64[] = [30_000_000, 9_000_000, 140_000, 8_000];

const PROFILES: string[] = ["dense", "moderate", "sparse"];
const BASES: string[] = [BASE_DENSE, BASE_MODERATE, BASE_SPARSE];

// Build all corpora.
const corpora = new Array<Array<string>>(PROFILES.length);
for (let p = 0; p < PROFILES.length; p++) {
  const arr = new Array<string>(SIZES.length);
  for (let i = 0; i < SIZES.length; i++) {
    unchecked(
      (arr[i] = makeJsonString(unchecked(BASES[p]), unchecked(SIZES[i]))),
    );
  }
  unchecked((corpora[p] = arr));
}

// Module-level hot state.
let CUR_PTR: usize = 0;
let CUR_END: usize = 0;
let CUR_SLOT: usize = 0;
const slotHolder = new Array<string>(1);

function bench_PROD(): void {
  blackbox(fieldDeser_PROD(CUR_PTR, CUR_END, CUR_SLOT));
}
function bench_HYBRID(): void {
  blackbox(fieldDeser_HYBRID(CUR_PTR, CUR_END, CUR_SLOT));
}
function bench_STREAM(): void {
  blackbox(fieldDeser_STREAM(CUR_PTR, CUR_END, CUR_SLOT));
}

// Equivalence gate: all variants must match SWAR (ground truth).
const tA = new Array<string>(1);
const tB = new Array<string>(1);
const tC = new Array<string>(1);
const tD = new Array<string>(1);
for (let p = 0; p < PROFILES.length; p++) {
  const arr = unchecked(corpora[p]);
  for (let i = 0; i < arr.length; i++) {
    const v = unchecked(arr[i]);
    const ptr = changetype<usize>(v);
    const end = ptr + (v.length << 1);
    blackbox(deserializeStringField_SWAR<string>(ptr, end, tA.dataStart));
    blackbox(fieldDeser_PROD(ptr, end, tB.dataStart));
    blackbox(fieldDeser_HYBRID(ptr, end, tC.dataStart));
    blackbox(fieldDeser_STREAM(ptr, end, tD.dataStart));
    expect(unchecked(tB[0])).toBe(unchecked(tA[0]));
    expect(unchecked(tC[0])).toBe(unchecked(tA[0]));
    expect(unchecked(tD[0])).toBe(unchecked(tA[0]));
  }
}

CUR_SLOT = slotHolder.dataStart;

for (let p = 0; p < PROFILES.length; p++) {
  const tag = unchecked(PROFILES[p]);
  const arr = unchecked(corpora[p]);
  for (let i = 0; i < SIZES.length; i++) {
    const label = unchecked(LABELS[i]);
    const value = unchecked(arr[i]);
    const op = unchecked(OPS[i]);
    const bytes = String.UTF8.byteLength(value);
    CUR_PTR = changetype<usize>(value);
    CUR_END = CUR_PTR + (value.length << 1);

    bench("SIMD PROD " + tag + " (" + label + ")", bench_PROD, op, bytes);
    dumpToFile(
      "simd-string-deser-variants-prod-" + tag + "-" + label,
      "deserialize",
    );

    bench("SIMD HYBRID " + tag + " (" + label + ")", bench_HYBRID, op, bytes);
    dumpToFile(
      "simd-string-deser-variants-hybrid-" + tag + "-" + label,
      "deserialize",
    );

    bench("SIMD STREAM " + tag + " (" + label + ")", bench_STREAM, op, bytes);
    dumpToFile(
      "simd-string-deser-variants-stream-" + tag + "-" + label,
      "deserialize",
    );
  }
}
