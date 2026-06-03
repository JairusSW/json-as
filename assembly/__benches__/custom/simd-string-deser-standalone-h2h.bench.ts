import { bs } from "../../../lib/as-bs";
import { expect } from "../../__tests__/lib";
import { deserializeString_SIMD } from "../../deserialize/simd/string";
import { deserializeString_SWAR } from "../../deserialize/swar/string";
import { DESERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { hex4_to_u16_swar } from "../../util/swar";
import { bench, blackbox, dumpToFile } from "../lib/bench";

// Standalone (whole-value) SIMD string deserializer: NEW production (HYBRID)
// vs OLD (the prior "overflow-pattern" escaped scanner, reconstructed locally)
// vs SWAR, across escape densities. Validates that porting HYBRID into
// deserializeString_SIMD is a win, not just correct.

// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_5C = i16x8.splat(0x5c);

// --- OLD: verbatim reconstruction of the pre-HYBRID overflow-pattern scanner.
// @ts-expect-error: @inline is a valid decorator
@inline function deserializeEscapedString_OLD(
  payloadStart: usize,
  escapeStart: usize,
  srcEnd: usize,
): string {
  const prefixLen = <u32>(escapeStart - payloadStart);
  let srcStart = escapeStart;
  const srcEnd16 = srcEnd - 16;
  const outStart = bs.offset - bs.buffer;
  bs.ensureSize(u32(srcEnd - srcStart));
  if (prefixLen != 0) {
    memory.copy(bs.offset, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    store<v128>(bs.offset, block);

    const eq5C = i16x8.eq(block, SPLAT_5C);
    let mask = i16x8.bitmask(eq5C);

    if (mask == 0) {
      srcStart += 16;
      bs.offset += 16;
      continue;
    }

    let lastLane: usize = 0;
    do {
      const laneIdx = usize(ctz(mask) << 1);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const code = load<u16>(srcIdx, 2);

      bs.offset += laneIdx - lastLane;

      if (code !== 0x75) {
        const escaped = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
        mask &= mask - i32(escaped === 0x5c);
        store<u16>(bs.offset, escaped);
        store<v128>(bs.offset, load<v128>(srcIdx, 4), 2);

        const l6 = usize(laneIdx === 14);
        bs.offset += 2;
        srcStart += l6 << 1;
        lastLane = laneIdx + 4;
        continue;
      }

      const blk = load<u64>(srcIdx, 4);
      const escaped = hex4_to_u16_swar(blk);
      store<u16>(bs.offset, escaped);
      store<u64>(bs.offset, load<u64>(srcIdx, 12), 2);

      bs.offset += 2;
      if (laneIdx >= 6) {
        srcStart += laneIdx - 4;
      }
      lastLane = laneIdx + 12;
    } while (mask !== 0);

    if (lastLane < 16) {
      bs.offset += 16 - lastLane;
    }

    srcStart += 16;
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
      const escape = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
      store<u16>(bs.offset, escape);
      srcStart += 2;
    } else {
      const blk = load<u64>(srcStart, 2);
      const escaped = hex4_to_u16_swar(blk);
      store<u16>(bs.offset, escaped);
      srcStart += 10;
    }
    bs.offset += 2;
  }

  return bs.sliceOut<string>(outStart);
}

// @ts-expect-error: @inline is a valid decorator
@inline function copyStringFromSource_OLD(
  srcStart: usize,
  byteLength: usize,
): string {
  if (byteLength == 0) return changetype<string>("");
  // @ts-expect-error: __new is a runtime builtin
  const out = __new(byteLength, idof<string>());
  memory.copy(out, srcStart, byteLength);
  return changetype<string>(out);
}

function deserializeString_OLD(srcStart: usize, srcEnd: usize): string {
  srcStart += 2;
  srcEnd -= 2;
  const payloadStart = srcStart;
  do {
    const srcEnd16Fast = srcEnd - 16;
    while (srcStart < srcEnd16Fast) {
      const block = load<v128>(srcStart);
      if (i16x8.bitmask(i16x8.eq(block, SPLAT_5C)) != 0) break;
      srcStart += 16;
    }
    if (srcStart < srcEnd16Fast) break;
    while (srcStart < srcEnd) {
      if (load<u16>(srcStart) == 0x5c) break;
      srcStart += 2;
    }
    if (srcStart < srcEnd) break;
    return copyStringFromSource_OLD(payloadStart, srcEnd - payloadStart);
  } while (false);

  srcStart = payloadStart;
  const srcEnd16 = srcEnd - 16;
  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    const mask = i16x8.bitmask(i16x8.eq(block, SPLAT_5C));
    if (mask == 0) {
      srcStart += 16;
      continue;
    }
    const laneIdx = usize(ctz(mask) << 1);
    return inline.always(
      deserializeEscapedString_OLD(payloadStart, srcStart + laneIdx, srcEnd),
    );
  }
  while (srcStart < srcEnd) {
    if (load<u16>(srcStart) == 0x5c) {
      return inline.always(
        deserializeEscapedString_OLD(payloadStart, srcStart, srcEnd),
      );
    }
    srcStart += 2;
  }
  return copyStringFromSource_OLD(payloadStart, srcEnd - payloadStart);
}

// --- COMBO: overflow-pattern multi-escape-per-block (OLD's strength on dense)
// + clean-run bulk-memcpy (HYBRID's strength on sparse). +32 slack for the
// optimistic post-escape v128/u64 stores.
// @ts-expect-error: @inline is a valid decorator
@inline function deserializeEscapedString_COMBO(
  payloadStart: usize,
  escapeStart: usize,
  srcEnd: usize,
): string {
  const prefixLen = <u32>(escapeStart - payloadStart);
  const outStart = bs.offset - bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart) + 32);
  if (prefixLen != 0) {
    memory.copy(bs.offset, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let srcStart = escapeStart;
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;

  while (srcStart <= srcEnd16) {
    const block = load<v128>(srcStart);
    let mask = i16x8.bitmask(i16x8.eq(block, SPLAT_5C));
    if (mask == 0) {
      // clean: stream first block, bulk-copy continuation
      store<v128>(bs.offset, block);
      bs.offset += 16;
      srcStart += 16;
      if (srcStart <= srcEnd16) {
        const b2 = load<v128>(srcStart);
        if (i16x8.bitmask(i16x8.eq(b2, SPLAT_5C)) == 0) {
          const runStart = srcStart;
          srcStart += 16;
          while (srcStart <= srcEnd16) {
            if (i16x8.bitmask(i16x8.eq(load<v128>(srcStart), SPLAT_5C)) != 0)
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

    // escape block: optimistic store + in-block multi-lane fixup
    store<v128>(bs.offset, block);
    let lastLane: usize = 0;
    do {
      const laneIdx = usize(ctz(mask) << 1);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const code = load<u16>(srcIdx, 2);
      bs.offset += laneIdx - lastLane;
      if (code !== 0x75) {
        const escaped = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
        mask &= mask - i32(escaped === 0x5c);
        store<u16>(bs.offset, escaped);
        store<v128>(bs.offset, load<v128>(srcIdx, 4), 2);
        const l6 = usize(laneIdx === 14);
        bs.offset += 2;
        srcStart += l6 << 1;
        lastLane = laneIdx + 4;
        continue;
      }
      const blk = load<u64>(srcIdx, 4);
      store<u16>(bs.offset, hex4_to_u16_swar(blk));
      store<u64>(bs.offset, load<u64>(srcIdx, 12), 2);
      bs.offset += 2;
      if (laneIdx >= 6) srcStart += laneIdx - 4;
      lastLane = laneIdx + 12;
    } while (mask !== 0);
    if (lastLane < 16) bs.offset += 16 - lastLane;
    srcStart += 16;
  }

  // scalar tail
  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char != 0x5c) {
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

function deserializeString_COMBO(srcStart: usize, srcEnd: usize): string {
  srcStart += 2;
  srcEnd -= 2;
  const payloadStart = srcStart;
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;
  while (srcStart <= srcEnd16) {
    const block = load<v128>(srcStart);
    const mask = i16x8.bitmask(i16x8.eq(block, SPLAT_5C));
    if (mask == 0) {
      srcStart += 16;
      continue;
    }
    const laneIdx = usize(ctz(mask) << 1);
    return inline.always(
      deserializeEscapedString_COMBO(payloadStart, srcStart + laneIdx, srcEnd),
    );
  }
  while (srcStart < srcEnd) {
    if (load<u16>(srcStart) == 0x5c) {
      return inline.always(
        deserializeEscapedString_COMBO(payloadStart, srcStart, srcEnd),
      );
    }
    srcStart += 2;
  }
  return copyStringFromSource_OLD(payloadStart, srcEnd - payloadStart);
}

// --- Corpora: vary escape density ---
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

function bench_OLD(): void {
  blackbox(deserializeString_OLD(CUR_PTR, CUR_END));
}
function bench_NEW(): void {
  blackbox(deserializeString_SIMD(CUR_PTR, CUR_END));
}
function bench_COMBO(): void {
  blackbox(deserializeString_COMBO(CUR_PTR, CUR_END));
}

// Equivalence gate vs SWAR ground truth.
for (let p = 0; p < PROFILES.length; p++) {
  const arr = unchecked(corpora[p]);
  for (let i = 0; i < arr.length; i++) {
    const v = unchecked(arr[i]);
    const ptr = changetype<usize>(v);
    const end = ptr + (v.length << 1);
    const ref = deserializeString_SWAR(ptr, end);
    expect(deserializeString_OLD(ptr, end)).toBe(ref);
    expect(deserializeString_SIMD(ptr, end)).toBe(ref);
    expect(deserializeString_COMBO(ptr, end)).toBe(ref);
  }
}

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

    bench("Standalone OLD " + tag + " (" + label + ")", bench_OLD, op, bytes);
    dumpToFile(
      "simd-string-deser-standalone-old-" + tag + "-" + label,
      "deserialize",
    );

    bench("Standalone NEW " + tag + " (" + label + ")", bench_NEW, op, bytes);
    dumpToFile(
      "simd-string-deser-standalone-new-" + tag + "-" + label,
      "deserialize",
    );

    bench(
      "Standalone COMBO " + tag + " (" + label + ")",
      bench_COMBO,
      op,
      bytes,
    );
    dumpToFile(
      "simd-string-deser-standalone-combo-" + tag + "-" + label,
      "deserialize",
    );
  }
}
