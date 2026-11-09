// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { STRING_METADATA_MASK, STRING_SIZE_MASK } from "../../util/runtime";
import { bs } from "../../../lib/as-bs";
import { BACK_SLASH } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { u16_to_hex4_swar } from "../../util/swar";
// @ts-expect-error: @lazy is a valid decorator
@lazy const U00_MARKER = 13511005048209500;
// @ts-expect-error: @lazy is a valid decorator
@lazy const U_MARKER = 7667804;
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_0022 = i16x8.splat(0x0022); // "
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_005C = i16x8.splat(0x005c); // \
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_0020 = i16x8.splat(0x0020); // space and control check
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_FFD8 = i16x8.splat(i16(0xd7fe));
// @ts-expect-error: @lazy is a valid decorator
@lazy const SURROGATE_MASK = i16x8.splat(i16(0xf800));
// @ts-expect-error: @lazy is a valid decorator
@lazy const SURROGATE_BASE = i16x8.splat(i16(0xd800));
// @ts-expect-error: @lazy is a valid decorator
@lazy const SURROGATE_LOW_BOUND = i16x8.splat(i16(0xdc00));
// @ts-expect-error: @lazy is a valid decorator
@lazy const BYTE_QUOTE = i8x16.splat(0x22);
// @ts-expect-error: @lazy is a valid decorator
@lazy const BYTE_BACKSLASH = i8x16.splat(0x5c);
// @ts-expect-error: @lazy is a valid decorator
@lazy const BYTE_SPACE = i8x16.splat(0x20);

// String payload sizes are always even. A compatible runtime reserves bit 0
// of String.rtSize as a completed escape-free classification; all byte-size
// consumers mask it while String.length's existing shift is unchanged.
const STRING_CLEAN_FLAG: u32 = STRING_METADATA_MASK;

/**
 * Serializes strings into their JSON counterparts using SIMD operations
 */
export function serializeString_SIMD(src: string): void {
  let srcStart = changetype<usize>(src);
  const object = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD);
  const taggedSize = object.rtSize;
  if (taggedSize < 32) {
    bs.proposeSize(taggedSize + 4);
    bs.offset =
      taggedSize < 16
        ? serializeShortStringReservedAt_SIMD(srcStart, taggedSize, bs.offset)
        : serializeMediumStringReservedAt_SIMD(srcStart, taggedSize, bs.offset);
    return;
  }
  const srcSize = taggedSize & STRING_SIZE_MASK;
  bs.proposeSize(srcSize + 4);
  const dst = bs.offset;
  if (taggedSize & STRING_CLEAN_FLAG) {
    bs.offset = copyKnownCleanString(srcStart, srcSize, dst);
    return;
  }
  const next = serializeStringRangeReservedAt_SIMD(srcStart, srcSize, dst);
  bs.offset = next;
  if (next - dst == <usize>srcSize + 4)
    object.rtSize = taggedSize | STRING_CLEAN_FLAG;
}


@inline
export function serializeStringRange_SIMD(srcStart: usize, srcSize: u32): void {
  bs.proposeSize(srcSize + 4);
  serializeStringRangeReserved_SIMD(srcStart, srcSize);
}

/** Emits a string whose unescaped payload and quotes are already reserved. */
export function serializeStringRangeReserved_SIMD(
  srcStart: usize,
  srcSize: u32,
): void {
  bs.offset = serializeStringRangeReservedAt_SIMD(srcStart, srcSize, bs.offset);
}

/** Emits a pre-reserved string and returns the next output cursor. Clean
 * strings never publish the cursor through shared builder state. */
export function serializeStringRangeReservedAt_SIMD(
  srcStart: usize,
  srcSize: u32,
  dstStart: usize,
): usize {
  const srcEnd = srcStart + srcSize;
  let dst = dstStart + 2;
  do {
    const srcEnd32Fast = srcEnd - 32;
    while (srcStart <= srcEnd32Fast) {
      const first = load<v128>(srcStart);
      const second = load<v128>(srcStart, 16);
      // Classify sixteen UTF-16 units with one packed byte vector. Signed
      // narrowing preserves ASCII and saturates every non-ASCII unit outside
      // the JSON control range; the conservative byte-level surrogate test is
      // retained for the exceptional path below.
      const bytes = i8x16.narrow_i16x8_s(first, second);
      // Signed narrowing maps controls to 0..31, ordinary positive non-ASCII
      // units to +127, and U+8000..FFFF (including surrogates) to -128. One
      // signed comparison therefore covers both controls and the conservative
      // Unicode candidate formerly tested with a separate equality.
      const special = v128.or(
        i8x16.eq(bytes, BYTE_QUOTE),
        v128.or(i8x16.eq(bytes, BYTE_BACKSLASH), i8x16.lt_s(bytes, BYTE_SPACE)),
      );
      // The payload is already reserved. Publish the candidate block before
      // resolving its mask so clean-copy stores can overlap classification;
      // the exceptional path rewrites this same output range on a hit.
      store<v128>(dst, first);
      store<v128>(dst, second, 16);
      if (v128.any_true(special)) break;
      srcStart += 32;
      dst += 32;
    }

    const srcEnd16Fast = srcEnd - 16;

    while (srcStart <= srcEnd16Fast) {
      const block = load<v128>(srcStart);
      const eq22 = i16x8.eq(block, SPLAT_0022);
      const eq5C = i16x8.eq(block, SPLAT_005C);
      const lt20 = i16x8.lt_u(block, SPLAT_0020);
      const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);

      const special = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));
      if (v128.any_true(special)) {
        // The byte-level candidate test can also match ordinary BMP text.
        // Verify only candidate blocks so ASCII keeps the cheaper hot loop.
        const surrogate = i16x8.eq(
          v128.and(block, SURROGATE_MASK),
          SURROGATE_BASE,
        );
        if (v128.any_true(v128.or(eq22, v128.or(eq5C, lt20)))) break;
        const surrogateBits = i8x16.bitmask(surrogate) & 0x5555;
        if (!surrogateBits) {
          // Ordinary BMP text triggered the conservative byte test. Copy the
          // proven block, then classify whole UTF-16 units for this string.
          store<v128>(dst, block);
          srcStart += 16;
          dst += 16;
          if (srcStart <= srcEnd16Fast) {
            const next = copyCleanUnicode(srcStart, srcEnd, dst);
            dst += next - srcStart;
            srcStart = next;
          }
          break;
        }
        if (surrogateBits) {
          const high =
            i8x16.bitmask(i16x8.lt_u(block, SURROGATE_LOW_BOUND)) &
            surrogateBits;
          const low = surrogateBits ^ high;
          const unpaired = (high & ~(low >> 2)) | (low & ~(high << 2));
          if (unpaired) {
            // A high surrogate at the end may pair with the following unit.
            // Consume that unit now so the next block never sees a lone low.
            if (
              unpaired != 0x4000 ||
              (high & 0x4000) == 0 ||
              srcEnd - srcStart < 18
            )
              break;
            const next = load<u16>(srcStart, 16);
            if (<u32>(next - 0xdc00) > 0x3ff) break;
            store<v128>(dst, block);
            store<u16>(dst, next, 16);
            srcStart += 18;
            dst += 18;
            continue;
          }
        }
      }

      store<v128>(dst, block);
      srcStart += 16;
      dst += 16;
    }
    if (srcStart <= srcEnd16Fast) break;

    while (srcStart <= srcEnd - 2) {
      const code = load<u16>(srcStart);
      if (
        (code >= 0xd800 && code <= 0xdfff) ||
        code == BACK_SLASH ||
        code == 34 ||
        code < 32
      )
        break;
      store<u16>(dst, code);
      srcStart += 2;
      dst += 2;
    }
    if (srcStart <= srcEnd - 2) break;

    store<u16>(dstStart, 34); // "
    store<u16>(dst, 34); // "
    return dst + 2;
  } while (false);

  // The optimistic loop already copied the clean prefix. Keep it and resume
  // at the first exceptional block, including conservative Unicode hits.
  store<u16>(dstStart, 34);
  bs.offset = dst;
  const srcEnd16 = srcEnd - 16;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);

    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    // console.log("\nblock  : " + mask_to_string_v128(block));
    // console.log("eq22   : " + mask_to_string_v128(eq22) + " -> " + mask_to_string_v128(SPLAT_0022));
    // console.log("eq5C   : " + mask_to_string_v128(eq5C) + " -> " + mask_to_string_v128(SPLAT_005C));
    // console.log("lt20   : " + mask_to_string_v128(lt20) + " -> " + mask_to_string_v128(SPLAT_0020));
    // console.log("gteD8  : " + mask_to_string_v128(gteD8) + " -> " + mask_to_string_v128(SPLAT_FFD8));

    // i16 comparison lanes set both constituent byte bits. Keep only the low
    // byte bit for ASCII escapes and only the high byte bit for conservative
    // surrogate candidates so every UTF-16 unit is visited at most once.
    let mask =
      (i8x16.bitmask(v128.or(eq22, v128.or(eq5C, lt20))) & 0x5555) |
      (i8x16.bitmask(gteD8) & 0xaaaa);

    if (mask == 0) {
      store<v128>(bs.offset, block);
      bs.offset += 16;
      srcStart += 16;
      // A clean suffix after an escape uses the same checked Unicode loop.
      // Keep its cursor local instead of updating shared state per vector.
      if (srcStart <= srcEnd16) {
        const next = copyCleanUnicode(srcStart, srcEnd, bs.offset);
        bs.offset += next - srcStart;
        srcStart = next;
      }
      continue;
    }

    const maxGrowth = <u32>popcnt(mask) * 10;
    bs.prepareGrowth(maxGrowth, maxGrowth + 32);

    store<v128>(bs.offset, block);

    do {
      const laneIdx = ctz(mask);
      const srcIdx = srcStart + laneIdx;

      mask &= mask - 1;
      // Even (0 2 4 6 8 10 12 14) -> Possible ASCII escape
      // Odd (1 3 5 7 9 11 13 15) -> Possibly a Unicode code unit or surrogate

      if ((laneIdx & 1) === 0) {
        const code = load<u16>(srcIdx);
        // The byte mask is conservative: a non-ASCII code unit can also set
        // this bit. Only actual JSON escapes may index the ASCII escape table.
        if (code >= 32 && code != 34 && code != BACK_SLASH) continue;
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));

        if ((escaped & 0xffff) != BACK_SLASH) {
          bs.addSize(10);
          // The block reservation above covers this optimistic v128 suffix
          // copy beyond the logical escape expansion.
          const dstIdx = bs.offset + laneIdx;
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, escaped, 8);
          if (srcIdx + 18 <= srcEnd) {
            store<v128>(dstIdx, load<v128>(srcIdx, 2), 12);
          } else if (srcIdx + 2 < srcEnd) {
            memory.copy(dstIdx + 12, srcIdx + 2, srcEnd - (srcIdx + 2));
          }
          bs.offset += 10;
        } else {
          bs.addSize(2);
          const dstIdx = bs.offset + laneIdx;
          store<u32>(dstIdx, escaped);
          if (srcIdx + 18 <= srcEnd) {
            store<v128>(dstIdx, load<v128>(srcIdx, 2), 4);
          } else if (srcIdx + 2 < srcEnd) {
            memory.copy(dstIdx + 4, srcIdx + 2, srcEnd - (srcIdx + 2));
          }
          // memory.copy(dstIdx + 4, srcIdx + 2, 14 - laneIdx);
          bs.offset += 2;
        }
        continue;
      }

      const code = load<u16>(srcIdx - 1);
      // console.log("\nb->" + mask_to_string_v128(block));
      // console.log("h->" + mask_to_string_v128(sieve));
      // console.log("z->" + mask_to_string_v128(i8x16.ge_u(block,SPLAT_FFD8)));
      // console.log("m->" + mask.toString(2));
      // console.log("l->" + laneIdx.toString());
      // console.log("c->" + code.toString(16));
      if (code < 0xd800 || code > 0xdfff) continue;

      if (code <= 0xdbff && srcIdx + 1 <= srcEnd - 2) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          // paired surrogate
          // If the low surrogate is in the next block, copy and consume it
          // now so the next iteration cannot treat it as an unpaired unit.
          if (laneIdx == 15) {
            store<u16>(bs.offset + 16, next);
            srcStart += 2;
            bs.offset += 2;
          }
          mask &= ~(0b11 << (laneIdx + 1));
          continue;
        }
      }

      bs.addSize(10);
      // unpaired high/low surrogate
      const dstIdx = bs.offset + laneIdx - 1;
      store<u32>(dstIdx, U_MARKER); // \u
      store<u64>(dstIdx, u16_to_hex4_swar(code), 4);
      // memory.copy(dstIdx + 12, srcIdx + 1, 15 - laneIdx);
      if (srcIdx + 17 <= srcEnd) {
        store<v128>(dstIdx, load<v128>(srcIdx, 1), 12);
      } else if (srcIdx + 1 < srcEnd) {
        memory.copy(dstIdx + 12, srcIdx + 1, srcEnd - (srcIdx + 1));
      }
      bs.offset += 10;
    } while (mask !== 0);

    srcStart += 16;
    bs.offset += 16;
  }

  while (srcStart <= srcEnd - 2) {
    const code = load<u16>(srcStart);
    if (code == 92 || code == 34 || code < 32) {
      const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
      if ((escaped & 0xffff) != BACK_SLASH) {
        bs.growSize(10);
        store<u64>(bs.offset, U00_MARKER);
        store<u32>(bs.offset, escaped, 8);
        bs.offset += 12;
      } else {
        bs.growSize(2);
        store<u32>(bs.offset, escaped);
        bs.offset += 4;
      }
      srcStart += 2;
      continue;
    }

    if (code < 0xd800 || code > 0xdfff) {
      store<u16>(bs.offset, code);
      bs.offset += 2;
      srcStart += 2;
      continue;
    }

    if (code <= 0xdbff && srcStart + 2 <= srcEnd - 2) {
      const next = load<u16>(srcStart, 2);
      if (next >= 0xdc00 && next <= 0xdfff) {
        // valid surrogate pair
        store<u16>(bs.offset, code);
        store<u16>(bs.offset + 2, next);
        bs.offset += 4;
        srcStart += 4;
        continue;
      }
    }

    // unpaired high/low surrogate
    write_u_escape(code);
    srcStart += 2;
    continue;
  }

  store<u16>(bs.offset, 34); // "
  bs.offset += 2;
  return bs.offset;
}

/** Emits a complete managed string and records an escape-free scan in its
 * structurally spare size bit. Ranges never use this entry because their
 * source need not begin at a managed String payload. */
@inline
export function serializeStringPointerReservedAt_SIMD(
  srcStart: usize,
  dstStart: usize,
): usize {
  const object = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD);
  const taggedSize = object.rtSize;
  if (taggedSize & STRING_CLEAN_FLAG) {
    const srcSize = taggedSize & STRING_SIZE_MASK;
    return copyKnownCleanString(srcStart, srcSize, dstStart);
  }
  if (taggedSize < 32)
    return taggedSize < 16
      ? serializeShortStringReservedAt_SIMD(srcStart, taggedSize, dstStart)
      : serializeMediumStringReservedAt_SIMD(srcStart, taggedSize, dstStart);
  const next = serializeStringRangeReservedAt_SIMD(
    srcStart,
    taggedSize,
    dstStart,
  );
  if (taggedSize >= 32 && next - dstStart == <usize>taggedSize + 4)
    object.rtSize = taggedSize | STRING_CLEAN_FLAG;
  return next;
}

/** Compact clean path for eight to fifteen UTF-16 units. Exceptional input
 * falls back to the complete shared writer. */
function serializeMediumStringReservedAt_SIMD(
  srcStart: usize,
  srcSize: u32,
  dstStart: usize,
): usize {
  const block = load<v128>(srcStart);
  const special = v128.or(
    i16x8.eq(block, SPLAT_0022),
    v128.or(
      i16x8.eq(block, SPLAT_005C),
      v128.or(
        i16x8.lt_u(block, SPLAT_0020),
        i16x8.eq(v128.and(block, SURROGATE_MASK), SURROGATE_BASE),
      ),
    ),
  );
  if (v128.any_true(special))
    return serializeStringRangeReservedAt_SIMD(srcStart, srcSize, dstStart);

  store<u16>(dstStart, 34);
  store<v128>(dstStart, block, 2);
  let src = srcStart + 16;
  let dst = dstStart + 18;
  const srcEnd = srcStart + srcSize;
  while (src < srcEnd) {
    const code = load<u16>(src);
    if (
      (code >= 0xd800 && code <= 0xdfff) ||
      code == BACK_SLASH ||
      code == 34 ||
      code < 32
    )
      return serializeStringRangeReservedAt_SIMD(srcStart, srcSize, dstStart);
    store<u16>(dst, code);
    src += 2;
    dst += 2;
  }
  store<u16>(dst, 34);
  return dst + 2;
}

function copyKnownCleanString(
  src: usize,
  srcSize: u32,
  dstStart: usize,
): usize {
  const end = src + srcSize;
  let dst = dstStart + 2;
  while (src + 32 <= end) {
    store<v128>(dst, load<v128>(src));
    store<v128>(dst, load<v128>(src, 16), 16);
    src += 32;
    dst += 32;
  }
  if (src < end) {
    // Completed-clean metadata is only recorded for payloads of at least 32
    // bytes. Copy the exact final 32 bytes when a partial chunk remains; its
    // overlap with the preceding chunk removes the 16/8/4/2 tail cascade.
    const tail = end - 32;
    const dstTail = dstStart + 2 + srcSize - 32;
    store<v128>(dstTail, load<v128>(tail));
    store<v128>(dstTail, load<v128>(tail, 16), 16);
    dst = dstStart + 2 + srcSize;
  }
  store<u16>(dstStart, 34);
  store<u16>(dst, 34);
  return dst + 2;
}

/** Compact generated-field entry for at most seven UTF-16 units. The caller
 * already reserved the unescaped payload. Exceptional input falls back to the
 * complete shared writer. */
export function serializeShortStringReservedAt_SIMD(
  srcStart: usize,
  srcSize: u32,
  dstStart: usize,
): usize {
  const srcEnd = srcStart + srcSize;
  let src = srcStart;
  let dst = dstStart + 2;
  while (src < srcEnd) {
    const code = load<u16>(src);
    if (
      (code >= 0xd800 && code <= 0xdfff) ||
      code == BACK_SLASH ||
      code == 34 ||
      code < 32
    )
      return serializeStringRangeReservedAt_SIMD(srcStart, srcSize, dstStart);
    store<u16>(dst, code);
    src += 2;
    dst += 2;
  }
  store<u16>(dstStart, 34);
  store<u16>(dst, 34);
  return dst + 2;
}

/** Copy clean UTF-16 after a byte-level false positive, stopping at an escape. */
function copyCleanUnicode(src: usize, end: usize, dst: usize): usize {
  const end32 = end - 32;
  while (src <= end32) {
    const first = load<v128>(src);
    const second = load<v128>(src, 16);
    // Signed saturation preserves ASCII and maps every other UTF-16 unit to
    // a byte >= 0x7f. Unsigned saturation would turn negative i16 lanes into 0.
    const bytes = i8x16.narrow_i16x8_s(first, second);
    const ascii = v128.or(
      i8x16.eq(bytes, BYTE_QUOTE),
      v128.or(i8x16.eq(bytes, BYTE_BACKSLASH), i8x16.lt_u(bytes, BYTE_SPACE)),
    );
    const firstSurrogate = i16x8.eq(
      v128.and(first, SURROGATE_MASK),
      SURROGATE_BASE,
    );
    const secondSurrogate = i16x8.eq(
      v128.and(second, SURROGATE_MASK),
      SURROGATE_BASE,
    );
    if (v128.any_true(v128.or(ascii, v128.or(firstSurrogate, secondSurrogate))))
      break;
    store<v128>(dst, first);
    store<v128>(dst, second, 16);
    src += 32;
    dst += 32;
  }
  const end16 = end - 16;
  while (src <= end16) {
    const block = load<v128>(src);
    const ascii = v128.or(
      i16x8.eq(block, SPLAT_0022),
      v128.or(i16x8.eq(block, SPLAT_005C), i16x8.lt_u(block, SPLAT_0020)),
    );
    const surrogate = i16x8.eq(v128.and(block, SURROGATE_MASK), SURROGATE_BASE);
    if (v128.any_true(v128.or(ascii, surrogate))) {
      if (v128.any_true(ascii)) return src;
      const bits = i8x16.bitmask(surrogate) & 0x5555;
      const high = i8x16.bitmask(i16x8.lt_u(block, SURROGATE_LOW_BOUND)) & bits;
      const low = bits ^ high;
      const unpaired = (high & ~(low >> 2)) | (low & ~(high << 2));
      if (unpaired) {
        // A final high unit may pair with the first unit beyond this vector.
        if (unpaired != 0x4000 || (high & 0x4000) == 0 || end - src < 18)
          return src;
        const next = load<u16>(src, 16);
        if (<u32>(next - 0xdc00) > 0x3ff) return src;
        store<v128>(dst, block);
        store<u16>(dst, next, 16);
        src += 18;
        dst += 18;
        continue;
      }
    }
    store<v128>(dst, block);
    src += 16;
    dst += 16;
  }
  return src;
}

function write_u_escape(code: u16): void {
  bs.growSize(10);
  store<u32>(bs.offset, U_MARKER); // "\u"
  store<u64>(bs.offset, u16_to_hex4_swar(code), 4);
  bs.offset += 12;
}
