import { bs } from "../../../lib/as-bs";
import { expect } from "../../__tests__/lib";
import {
  deserializeString_SWAR,
  deserializeStringField_SWAR,
} from "../../deserialize/swar/string";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { DESERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { hex4_to_u16_swar } from "../../util/swar";
import { bench, blackbox, dumpToFile } from "../lib/bench";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { __heap_base } from "memory";

// SWAR HYBRID exploration - apply the SIMD-winning HYBRID strategy (escape
// block: optimistic whole-block store covers the plain prefix; clean run:
// stream first block then bulk-memcpy the remainder) to BOTH SWAR string
// deserializers, vs current production (field = run-copy SplitTuned;
// standalone = overflow/stream). SWAR masks are unsafe (high-byte false
// positives) so hits are confirmed scalarly. Benched across escape densities.

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
@inline function bs_mask(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  return (b - 0x0001_0001_0001_0001) & ~b & 0x0080_0080_0080_0080;
}

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
@inline function copyStringFromSource(
  srcStart: usize,
  byteLength: usize,
): string {
  if (byteLength == 0) return changetype<string>("");
  const out = __new(byteLength, idof<string>());
  memory.copy(out, srcStart, byteLength);
  return changetype<string>(out);
}

// ===================== FIELD: HYBRID =====================
// @ts-expect-error: @inline is a valid decorator
@inline function escField_HYBRID(
  payloadStart: usize,
  escapeStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  const prefixLen = <u32>(escapeStart - payloadStart);
  bs.offset = bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart) + 8); // +8 slack for u64 overcopy
  if (prefixLen != 0) {
    memory.copy(bs.buffer, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let srcStart = escapeStart;
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;

  while (srcStart <= srcEnd8) {
    const block = load<u64>(srcStart);
    let mask = inline.always(bsq_mask(block));
    if (mask == 0) {
      store<u64>(bs.offset, block);
      bs.offset += 8;
      srcStart += 8;
      if (
        srcStart <= srcEnd8 &&
        inline.always(bsq_mask(load<u64>(srcStart))) == 0
      ) {
        const runStart = srcStart;
        srcStart += 8;
        while (
          srcStart <= srcEnd8 &&
          inline.always(bsq_mask(load<u64>(srcStart))) == 0
        ) {
          srcStart += 8;
        }
        const runLen = <u32>(srcStart - runStart);
        memory.copy(bs.offset, runStart, runLen);
        bs.offset += runLen;
      }
      continue;
    }

    // potential escape/quote (mask may carry false positives)
    store<u64>(bs.offset, block);
    let handled = false;
    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const char = load<u16>(srcIdx);
      if (char != QUOTE && char != BACK_SLASH) continue; // false positive
      bs.offset += laneIdx;
      if (char == QUOTE) {
        writeStringToField(
          dstFieldPtr,
          bs.buffer,
          <u32>(bs.offset - bs.buffer),
        );
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
      handled = true;
      break;
    } while (mask != 0);
    if (!handled) {
      bs.offset += 8;
      srcStart += 8;
    }
  }

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

function fieldDeser_PROD(srcStart: usize, srcEnd: usize, dst: usize): usize {
  return deserializeStringField_SWAR<string>(srcStart, srcEnd, dst);
}
function fieldDeser_HYBRID(srcStart: usize, srcEnd: usize, dst: usize): usize {
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE)
    abort("Expected leading quote");
  const payloadStart = srcStart + 2;
  srcStart = payloadStart;
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;
  while (srcStart <= srcEnd8) {
    let mask = inline.always(bsq_mask(load<u64>(srcStart)));
    if (mask == 0) {
      srcStart += 8;
      continue;
    }
    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const char = load<u16>(srcIdx);
      if (char == QUOTE) {
        writeStringToField(dst, payloadStart, <u32>(srcIdx - payloadStart));
        return srcIdx + 2;
      }
      if (char != BACK_SLASH) continue;
      return inline.always(escField_HYBRID(payloadStart, srcIdx, srcEnd, dst));
    } while (mask != 0);
    srcStart += 8;
  }
  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      writeStringToField(dst, payloadStart, <u32>(srcStart - payloadStart));
      return srcStart + 2;
    }
    if (char == BACK_SLASH) {
      return inline.always(
        escField_HYBRID(payloadStart, srcStart, srcEnd, dst),
      );
    }
    srcStart += 2;
  }
  abort("Unterminated string literal");
  return srcStart;
}

// ===================== STANDALONE: HYBRID =====================
// @ts-expect-error: @inline is a valid decorator
@inline function escStd_HYBRID(
  payloadStart: usize,
  escapeStart: usize,
  srcEnd: usize,
): string {
  const prefixLen = <u32>(escapeStart - payloadStart);
  const outStart = bs.offset - bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart) + 8);
  if (prefixLen != 0) {
    memory.copy(bs.offset, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let srcStart = escapeStart;
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;

  while (srcStart <= srcEnd8) {
    const block = load<u64>(srcStart);
    let mask = inline.always(bs_mask(block));
    if (mask == 0) {
      store<u64>(bs.offset, block);
      bs.offset += 8;
      srcStart += 8;
      if (
        srcStart <= srcEnd8 &&
        inline.always(bs_mask(load<u64>(srcStart))) == 0
      ) {
        const runStart = srcStart;
        srcStart += 8;
        while (
          srcStart <= srcEnd8 &&
          inline.always(bs_mask(load<u64>(srcStart))) == 0
        ) {
          srcStart += 8;
        }
        const runLen = <u32>(srcStart - runStart);
        memory.copy(bs.offset, runStart, runLen);
        bs.offset += runLen;
      }
      continue;
    }

    store<u64>(bs.offset, block);
    let handled = false;
    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      if ((load<u32>(srcIdx) & 0xffff) !== 0x5c) continue; // false positive
      bs.offset += laneIdx;
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
      handled = true;
      break;
    } while (mask != 0);
    if (!handled) {
      bs.offset += 8;
      srcStart += 8;
    }
  }

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
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
  return bs.sliceOut<string>(outStart);
}

// COMBO: overflow multi-escape-per-block (PROD's moderate strength) + bulk-run
// copy on long clean runs (HYBRID's sparse strength).
// @ts-expect-error: @inline is a valid decorator
@inline function escStd_COMBO(
  payloadStart: usize,
  escapeStart: usize,
  srcEnd: usize,
): string {
  const srcEnd8 = srcEnd - 8;
  const prefixLen = <u32>(escapeStart - payloadStart);
  const outStart = bs.offset - bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart) + 8);
  if (prefixLen != 0) {
    memory.copy(bs.offset, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let srcStart = escapeStart;

  while (srcStart < srcEnd8) {
    const block = load<u64>(srcStart);
    let mask = inline.always(bs_mask(block));
    if (mask === 0) {
      store<u64>(bs.offset, block);
      srcStart += 8;
      bs.offset += 8;
      // bulk-run continuation on long clean stretches
      if (
        srcStart < srcEnd8 &&
        inline.always(bs_mask(load<u64>(srcStart))) == 0
      ) {
        const runStart = srcStart;
        srcStart += 8;
        while (
          srcStart < srcEnd8 &&
          inline.always(bs_mask(load<u64>(srcStart))) == 0
        ) {
          srcStart += 8;
        }
        const runLen = <u32>(srcStart - runStart);
        memory.copy(bs.offset, runStart, runLen);
        bs.offset += runLen;
      }
      continue;
    }

    // overflow multi-escape-per-block (verbatim from production)
    store<u64>(bs.offset, block);
    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const dstIdx = bs.offset + laneIdx;
      const header = load<u32>(srcIdx);
      const code = <u16>(header >> 16);
      if ((header & 0xffff) !== 0x5c) continue;
      if (code !== 0x75) {
        const escaped = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
        mask &= mask - usize(escaped === 0x5c);
        store<u16>(dstIdx, escaped);
        store<u32>(dstIdx, load<u32>(srcIdx, 4), 2);
        const l6 = usize(laneIdx === 6);
        bs.offset -= (1 - l6) << 1;
        srcStart += l6 << 1;
        continue;
      }
      const blk = load<u64>(srcIdx, 4);
      const escaped = hex4_to_u16_swar(blk);
      store<u16>(dstIdx, escaped);
      srcStart += 4 + laneIdx;
      bs.offset -= 6 - laneIdx;
    } while (mask !== 0);
    bs.offset += 8;
    srcStart += 8;
  }

  while (srcStart < srcEnd) {
    const block = load<u16>(srcStart);
    store<u16>(bs.offset, block);
    srcStart += 2;
    if (block !== 0x5c) {
      bs.offset += 2;
      continue;
    }
    const code = load<u16>(srcStart);
    if (code !== 0x75) {
      store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
      srcStart += 2;
    } else {
      store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcStart, 2)));
      srcStart += 10;
    }
    bs.offset += 2;
  }
  return bs.sliceOut<string>(outStart);
}

function stdDeser_PROD(srcStart: usize, srcEnd: usize): string {
  return deserializeString_SWAR(srcStart, srcEnd);
}
function stdDeser_COMBO(srcStart: usize, srcEnd: usize): string {
  srcStart += 2;
  srcEnd -= 2;
  const payloadStart = srcStart;
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;
  while (srcStart <= srcEnd8) {
    let mask = inline.always(bs_mask(load<u64>(srcStart)));
    if (mask == 0) {
      srcStart += 8;
      continue;
    }
    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      if ((load<u32>(srcIdx) & 0xffff) !== 0x5c) continue;
      return inline.always(escStd_COMBO(payloadStart, srcIdx, srcEnd));
    } while (mask != 0);
    srcStart += 8;
  }
  while (srcStart < srcEnd) {
    if (load<u16>(srcStart) == BACK_SLASH) {
      return inline.always(escStd_COMBO(payloadStart, srcStart, srcEnd));
    }
    srcStart += 2;
  }
  return copyStringFromSource(payloadStart, srcEnd - payloadStart);
}
function stdDeser_HYBRID(srcStart: usize, srcEnd: usize): string {
  srcStart += 2;
  srcEnd -= 2;
  const payloadStart = srcStart;
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;
  while (srcStart <= srcEnd8) {
    let mask = inline.always(bs_mask(load<u64>(srcStart)));
    if (mask == 0) {
      srcStart += 8;
      continue;
    }
    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      if ((load<u32>(srcIdx) & 0xffff) !== 0x5c) continue;
      return inline.always(escStd_HYBRID(payloadStart, srcIdx, srcEnd));
    } while (mask != 0);
    srcStart += 8;
  }
  while (srcStart < srcEnd) {
    if (load<u16>(srcStart) == BACK_SLASH) {
      return inline.always(escStd_HYBRID(payloadStart, srcStart, srcEnd));
    }
    srcStart += 2;
  }
  return copyStringFromSource(payloadStart, srcEnd - payloadStart);
}

// ===================== Corpora =====================
const BASE_DENSE = "ab\\\\ncd\\\\tEF\\\\u0041G\\\\u263AH\\\\\\\\I";
const BASE_MODERATE =
  "the quick brown fox \\\\n jumps over \\\\t the lazy \\\\u0041 dog";
const BASE_SPARSE =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 the quick brown fox jumps over the lazy dog padding padding pad \\\\n";

function makeJsonString(base: string, targetBytes: usize): string {
  const targetLen = targetBytes >> 1;
  const repeats = i32((targetLen + base.length - 1) / base.length);
  return `"${base.repeat(repeats)}"`;
}

const SIZES: usize[] = [256, 1024, 64 * 1024, 1024 * 1024];
const LABELS: string[] = ["256b", "1kb", "64kb", "1mb"];
const OPS: u64[] = [20_000_000, 7_000_000, 110_000, 6_500];
const PROFILES: string[] = ["dense", "moderate", "sparse"];
const BASES: string[] = [BASE_DENSE, BASE_MODERATE, BASE_SPARSE];

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

let CUR_PTR: usize = 0;
let CUR_END: usize = 0;
let CUR_SLOT: usize = 0;
const slotHolder = new Array<string>(1);

function bench_field_PROD(): void {
  blackbox(fieldDeser_PROD(CUR_PTR, CUR_END, CUR_SLOT));
}
function bench_field_HYBRID(): void {
  blackbox(fieldDeser_HYBRID(CUR_PTR, CUR_END, CUR_SLOT));
}
function bench_std_PROD(): void {
  blackbox(stdDeser_PROD(CUR_PTR, CUR_END));
}
function bench_std_HYBRID(): void {
  blackbox(stdDeser_HYBRID(CUR_PTR, CUR_END));
}
function bench_std_COMBO(): void {
  blackbox(stdDeser_COMBO(CUR_PTR, CUR_END));
}

// Equivalence gate vs production.
const tA = new Array<string>(1);
const tB = new Array<string>(1);
for (let p = 0; p < PROFILES.length; p++) {
  const arr = unchecked(corpora[p]);
  for (let i = 0; i < arr.length; i++) {
    const v = unchecked(arr[i]);
    const ptr = changetype<usize>(v);
    const end = ptr + (v.length << 1);
    // standalone
    const ref = stdDeser_PROD(ptr, end);
    expect(stdDeser_HYBRID(ptr, end)).toBe(ref);
    expect(stdDeser_COMBO(ptr, end)).toBe(ref);
    // field
    fieldDeser_PROD(ptr, end, tA.dataStart);
    fieldDeser_HYBRID(ptr, end, tB.dataStart);
    expect(unchecked(tB[0])).toBe(unchecked(tA[0]));
    expect(unchecked(tA[0])).toBe(ref);
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

    bench(
      "Field SWAR PROD " + tag + " (" + label + ")",
      bench_field_PROD,
      op,
      bytes,
    );
    dumpToFile(
      "swar-string-deser-hybrid-field-prod-" + tag + "-" + label,
      "deserialize",
    );
    bench(
      "Field SWAR HYBRID " + tag + " (" + label + ")",
      bench_field_HYBRID,
      op,
      bytes,
    );
    dumpToFile(
      "swar-string-deser-hybrid-field-hybrid-" + tag + "-" + label,
      "deserialize",
    );

    bench(
      "Std SWAR PROD " + tag + " (" + label + ")",
      bench_std_PROD,
      op,
      bytes,
    );
    dumpToFile(
      "swar-string-deser-hybrid-std-prod-" + tag + "-" + label,
      "deserialize",
    );
    bench(
      "Std SWAR HYBRID " + tag + " (" + label + ")",
      bench_std_HYBRID,
      op,
      bytes,
    );
    dumpToFile(
      "swar-string-deser-hybrid-std-hybrid-" + tag + "-" + label,
      "deserialize",
    );
    bench(
      "Std SWAR COMBO " + tag + " (" + label + ")",
      bench_std_COMBO,
      op,
      bytes,
    );
    dumpToFile(
      "swar-string-deser-hybrid-std-combo-" + tag + "-" + label,
      "deserialize",
    );
  }
}
