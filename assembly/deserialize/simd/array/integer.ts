import { newNativeArray } from "../../../util/nativeArray";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { deserializeIntegerArray_SLOW } from "../../swar/array/integer";
import { isSpace } from "../../../util";
import { markProductionParseError } from "../../error";

const ASCII_LANE_MASK_4: u64 = 0x00ff00ff00ff00ff;
const ASCII_ZERO_4: u64 = 0x0030003000300030;

// @ts-expect-error: decorators valid here
@lazy const SPLAT_30 = i16x8.splat(0x30);

// @ts-expect-error: decorators valid here
@lazy const SPLAT_09 = i16x8.splat(9);

// @ts-expect-error: decorators valid here
@lazy const ZERO_I16X8 = i16x8.splat(0);

// @ts-expect-error: decorators valid here
@lazy const ZERO_I32X4 = i32x4.splat(0);

// @ts-expect-error: decorators valid here
@lazy const PACK_WEIGHTS_10_1 = i8x16(
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
);

// @ts-expect-error: decorators valid here
@lazy const PAIR_WEIGHTS_100_1 = i16x8(100, 1, 100, 1, 0, 0, 0, 0);

function storeSignedInteger<T extends number[]>(slot: usize, value: i64): void {
  if (sizeof<valueof<T>>() == sizeof<i8>()) {
    store<i8>(slot, <i8>value);
  } else if (sizeof<valueof<T>>() == sizeof<i16>()) {
    store<i16>(slot, <i16>value);
  } else if (sizeof<valueof<T>>() == sizeof<i32>()) {
    store<i32>(slot, <i32>value);
  } else if (sizeof<valueof<T>>() == sizeof<isize>()) {
    store<isize>(slot, <isize>value);
  } else {
    store<i64>(slot, value);
  }
}

function storeUnsignedInteger<T extends number[]>(
  slot: usize,
  value: u64,
): void {
  if (sizeof<valueof<T>>() == sizeof<u8>()) {
    store<u8>(slot, <u8>value);
  } else if (sizeof<valueof<T>>() == sizeof<u16>()) {
    store<u16>(slot, <u16>value);
  } else if (sizeof<valueof<T>>() == sizeof<u32>()) {
    store<u32>(slot, <u32>value);
  } else if (sizeof<valueof<T>>() == sizeof<usize>()) {
    store<usize>(slot, <usize>value);
  } else {
    store<u64>(slot, value);
  }
}

function tryParseEightDigitsSIMD(srcStart: usize, value: u64): u64 {
  const block = load<v128>(srcStart);
  const digits = i16x8.sub(block, SPLAT_30);
  if (v128.any_true(i16x8.gt_u(digits, SPLAT_09))) return 0;

  const packed = i8x16.narrow_i16x8_u(digits, ZERO_I16X8);
  const products = i16x8.extmul_low_i8x16_u(packed, PACK_WEIGHTS_10_1);
  const pairs = i32x4.extadd_pairwise_i16x8_u(products);
  const pairs16 = i16x8.narrow_i32x4_u(pairs, ZERO_I32X4);
  const groups = i32x4.dot_i16x8_s(pairs16, PAIR_WEIGHTS_100_1);

  const lo = i32x4.extract_lane(groups, 0);
  const hi = i32x4.extract_lane(groups, 1);
  return value * 100000000 + (<u64>lo * 10000 + <u64>hi);
}

// As in the SWAR variant: the parse helpers take a `slot` (`writePtr`) and
// store directly. The dispatcher owns `out.length = maxElements` and the
// per-element `writePtr` advance so `Array.push` is removed for every
function parseSignedIntegerSIMD<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  slot: usize,
): usize {
  let negative = false;
  let code = load<u16>(srcStart);
  if (code == 45) {
    negative = true;
    srcStart += 2;
    if (srcStart >= srcEnd) return 0;
    code = load<u16>(srcStart);
  }

  let digit = <u32>code - 48;
  if (digit > 9) return 0;

  let value: u64 = digit;
  srcStart += 2;

  while (srcStart + 14 < srcEnd) {
    const next = tryParseEightDigitsSIMD(srcStart, value);
    if (!next) break;
    value = next;
    srcStart += 16;
  }

  while (srcStart < srcEnd) {
    digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }

  storeSignedInteger<T>(slot, negative ? -(<i64>value) : <i64>value);
  return srcStart;
}

function parseUnsignedIntegerSIMD<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  slot: usize,
): usize {
  let digit = <u32>load<u16>(srcStart) - 48;
  if (digit > 9) return 0;

  let value: u64 = digit;
  srcStart += 2;

  while (srcStart + 14 < srcEnd) {
    const next = tryParseEightDigitsSIMD(srcStart, value);
    if (!next) break;
    value = next;
    srcStart += 16;
  }

  while (srcStart < srcEnd) {
    digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }

  storeUnsignedInteger<T>(slot, value);
  return srcStart;
}

// @ts-expect-error: decorators valid here
@lazy const COMMA_SPLAT_8 = i16x8.splat(<i16>COMMA);

// Pair-multiply weights for the common two-element packings in 8-char blocks.
// Lanes that fall on a `,` become garbage after the subtract-by-`0` but are
// killed by zero weights in `i32x4.dot_i16x8_s`. The 9 (a, b) combinations
// where a+b in {2..6} all reach via these weight vectors; the bottom three
// (one digit + one digit, etc.) are left to the SWAR cascade fallback since
// they hit <2% on the uniform 0..255 sweep and add branch cost here.
//   3+3 (`DDD,DDD,`)   bitmask 0x88, advance 16
//   3+2 (`DDD,DD,?`)   bitmask 0x48, advance 14
//   2+3 (`DD,DDD,?`)   bitmask 0x44, advance 14
//   2+2 (`DD,DD,??`)   bitmask 0x24, advance 12
//   3+1 (`DDD,D,??`)   bitmask 0x28, advance 12
//   1+3 (`D,DDD,??`)   bitmask 0x22, advance 12
// @ts-expect-error: decorators valid here
@lazy const PAIR_WEIGHTS_3_3_8 = i16x8(100, 10, 1, 0, 100, 10, 1, 0);

// @ts-expect-error: decorators valid here
@lazy const PAIR_WEIGHTS_3_2_8 = i16x8(100, 10, 1, 0, 10, 1, 0, 0);

// @ts-expect-error: decorators valid here
@lazy const PAIR_WEIGHTS_2_3_8 = i16x8(10, 1, 0, 100, 10, 1, 0, 0);

// @ts-expect-error: decorators valid here
@lazy const PAIR_WEIGHTS_2_2_8 = i16x8(10, 1, 0, 10, 1, 0, 0, 0);

// @ts-expect-error: decorators valid here
@lazy const PAIR_WEIGHTS_3_1_8 = i16x8(100, 10, 1, 0, 1, 0, 0, 0);

// @ts-expect-error: decorators valid here
@lazy const PAIR_WEIGHTS_1_3_8 = i16x8(1, 0, 100, 10, 1, 0, 0, 0);

// @ts-expect-error: decorators valid here
@lazy const SPLAT_30_8 = i16x8.splat(0x30);

/**
 * Narrow-lane (u8/i8) integer-array deserializer for SIMD mode.
 *
 * The 8-digit SIMD kernel (`tryParseEightDigitsSIMD`) can't fire for u8/i8
 * (max 3 digits), so we skip it entirely and instead pay SIMD cost where
 * it's a strict win: parsing packed comma-separated pairs. A conservative
 * capacity bound permits direct pointer stores; scalar tails validate their
 * digits and delimiters without a second input scan.
 */
function deserializeNarrowIntegerArray_SIMD<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
  if (srcEnd - srcStart < 4 || load<u16>(srcStart) != BRACKET_LEFT ||
      load<u16>(srcEnd - 2) != BRACKET_RIGHT) {
    markProductionParseError();
    return changetype<T>(0);
  }
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(newNativeArray<T>()),
  );

  // See SWAR variant: worst-case sizing is `(srcLen / 4)` elements (1 digit
  // + 1 delimiter per element). Zero-fill is skipped for u8/i8 in AS so the
  // over-allocation costs only a small amount of trimmed storage.
  const maxElements = i32((<usize>(srcEnd - srcStart)) >> 2);
  if (maxElements > 0) out.length = maxElements;
  const dataStart = out.dataStart;
  const elementSize = sizeof<valueof<T>>();
  let writePtr = dataStart;

  srcStart += 2;
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  if (srcStart + 2 == srcEnd && load<u16>(srcStart) == BRACKET_RIGHT) {
    out.length = 0;
    return out;
  }
  while (srcStart < srcEnd) {

    // Fast path: two packed 3-digit elements in one v128 load. Pattern
    // matches `DDD,DDD,` (commas at lanes 3 and 7) which is the majority of
    // pairs for any payload whose values frequently land in 100..255.
    // `i32x4.dot_i16x8_s` with the (100, 10, 1, 0) weights collapses the two
    // 3-digit folds into the dot lanes, then a pair of extracts+adds gives
    // both values without per-element scalar loops.
    if (!isSigned<valueof<T>>() && srcStart + 14 < srcEnd) {
      const block = load<v128>(srcStart);
      const commas = i16x8.eq(block, COMMA_SPLAT_8);
      const bitmask = i16x8.bitmask(commas);
      // Switch on the comma layout. Each branch is a single i32x4.dot with
      // its own (a, b) weight vector, plus 2-3 lane extracts that AS lowers
      // to constant-index reads. Ordered roughly by hit-rate on a uniform
      // 0..255 sweep (0x88 ~37%, 0x48/0x44 ~21% each, 0x24 ~12%, 0x28/0x22
      // ~2.4% each).
      const digits = i16x8.sub(block, SPLAT_30_8);
      // Commas are the only allowed non-digits in a packed block. One shared
      // mask check validates every lane before any dot-product writes.
      if (i16x8.all_true(v128.or(commas, i16x8.le_u(digits, i16x8.splat(9))))) {
        switch (bitmask) {
          case 0x88: {
            const dot = i32x4.dot_i16x8_s(digits, PAIR_WEIGHTS_3_3_8);
            const v1 = i32x4.extract_lane(dot, 0) + i32x4.extract_lane(dot, 1);
            const v2 = i32x4.extract_lane(dot, 2) + i32x4.extract_lane(dot, 3);
            store<valueof<T>>(writePtr, <valueof<T>>v1);
            store<valueof<T>>(writePtr + elementSize, <valueof<T>>v2);
            writePtr += elementSize << 1;
            srcStart += 16;
            continue;
          }
          case 0x48: {
            const dot = i32x4.dot_i16x8_s(digits, PAIR_WEIGHTS_3_2_8);
            const v1 = i32x4.extract_lane(dot, 0) + i32x4.extract_lane(dot, 1);
            const v2 = i32x4.extract_lane(dot, 2);
            store<valueof<T>>(writePtr, <valueof<T>>v1);
            store<valueof<T>>(writePtr + elementSize, <valueof<T>>v2);
            writePtr += elementSize << 1;
            srcStart += 14;
            continue;
          }
          case 0x44: {
            const dot = i32x4.dot_i16x8_s(digits, PAIR_WEIGHTS_2_3_8);
            const v1 = i32x4.extract_lane(dot, 0);
            const v2 = i32x4.extract_lane(dot, 1) + i32x4.extract_lane(dot, 2);
            store<valueof<T>>(writePtr, <valueof<T>>v1);
            store<valueof<T>>(writePtr + elementSize, <valueof<T>>v2);
            writePtr += elementSize << 1;
            srcStart += 14;
            continue;
          }
          case 0x24: {
            const dot = i32x4.dot_i16x8_s(digits, PAIR_WEIGHTS_2_2_8);
            const v1 = i32x4.extract_lane(dot, 0);
            const v2 = i32x4.extract_lane(dot, 1) + i32x4.extract_lane(dot, 2);
            store<valueof<T>>(writePtr, <valueof<T>>v1);
            store<valueof<T>>(writePtr + elementSize, <valueof<T>>v2);
            writePtr += elementSize << 1;
            srcStart += 12;
            continue;
          }
          case 0x28: {
            const dot = i32x4.dot_i16x8_s(digits, PAIR_WEIGHTS_3_1_8);
            const v1 = i32x4.extract_lane(dot, 0) + i32x4.extract_lane(dot, 1);
            const v2 = i32x4.extract_lane(dot, 2);
            store<valueof<T>>(writePtr, <valueof<T>>v1);
            store<valueof<T>>(writePtr + elementSize, <valueof<T>>v2);
            writePtr += elementSize << 1;
            srcStart += 12;
            continue;
          }
          case 0x22: {
            const dot = i32x4.dot_i16x8_s(digits, PAIR_WEIGHTS_1_3_8);
            const v1 = i32x4.extract_lane(dot, 0);
            const v2 = i32x4.extract_lane(dot, 1) + i32x4.extract_lane(dot, 2);
            store<valueof<T>>(writePtr, <valueof<T>>v1);
            store<valueof<T>>(writePtr + elementSize, <valueof<T>>v2);
            writePtr += elementSize << 1;
            srcStart += 12;
            continue;
          }
        }
      }
    }
    // Single-element SWAR fast paths cover the cases where the v128 block
    // didn't match 0x88 (mixed widths, partial element trailing the block).
    if (!isSigned<valueof<T>>() && srcStart + 6 < srcEnd) {
      const block64 = load<u64>(srcStart);
      if (((block64 >> 48) & 0xffff) == COMMA) {
        const digits =
          (block64 & 0x0000_ffff_ffff_ffff) - 0x0000_0030_0030_0030;
        const oor =
          (digits | (digits + 0x0000_0006_0006_0006)) & 0x0000_fff0_fff0_fff0;
        if (oor == 0) {
          const d0 = <u32>(digits & 0xffff);
          const d1 = <u32>((digits >> 16) & 0xffff);
          const d2 = <u32>((digits >> 32) & 0xffff);
          store<valueof<T>>(writePtr, <valueof<T>>(d0 * 100 + d1 * 10 + d2));
          writePtr += elementSize;
          srcStart += 8;
          continue;
        }
      } else if (((block64 >> 32) & 0xffff) == COMMA) {
        const digits =
          (block64 & 0x0000_0000_ffff_ffff) - 0x0000_0000_0030_0030;
        const oor =
          (digits | (digits + 0x0000_0000_0006_0006)) & 0x0000_0000_fff0_fff0;
        if (oor == 0) {
          const d0 = <u32>(digits & 0xffff);
          const d1 = <u32>((digits >> 16) & 0xffff);
          store<valueof<T>>(writePtr, <valueof<T>>(d0 * 10 + d1));
          writePtr += elementSize;
          srcStart += 6;
          continue;
        }
      } else if (((block64 >> 16) & 0xffff) == COMMA) {
        const d0 = <u32>(block64 & 0xffff) - 48;
        if (d0 <= 9) {
          store<valueof<T>>(writePtr, <valueof<T>>d0);
          writePtr += elementSize;
          srcStart += 4;
          continue;
        }
      }
    }
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    let negative = false;
    if (isSigned<valueof<T>>() && load<u16>(srcStart) == 45) {
      negative = true;
      srcStart += 2;
    }
    const digitStart = srcStart;
    let value: u64 = 0;
    while (srcStart < srcEnd) {
      const digit = <u32>load<u16>(srcStart) - 48;
      if (digit > 9) break;
      value = value * 10 + digit;
      srcStart += 2;
    }
    if (srcStart == digitStart) break;
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    const delimiter = load<u16>(srcStart);
    if (delimiter != COMMA && delimiter != BRACKET_RIGHT) break;
    store<valueof<T>>(writePtr, negative ? <valueof<T>>-(<i64>value) : <valueof<T>>value);
    writePtr += elementSize;
    srcStart += 2;
    if (delimiter == BRACKET_RIGHT) {
      if (srcStart != srcEnd) break;
      out.length = i32(<usize>(writePtr - dataStart) / elementSize);
      return out;
    }
  }
  markProductionParseError();
  return changetype<T>(0);
}

// @ts-ignore: Decorator valid here
export function deserializeIntegerArray_SIMD<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  // u8/i8 elements never amortize the 8-digit SIMD kernel; route them
  // through the SIMD-counted narrow-lane fast path. AS folds the sizeof
  // check at compile time.
  if (sizeof<valueof<T>>() <= 1) {
    return deserializeNarrowIntegerArray_SIMD<T>(srcStart, srcEnd, dst);
  }
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(newNativeArray<T>()),
  );
  const originalSrcStart = srcStart;
  const reusableLength = load<i32>(
    changetype<usize>(out),
    offsetof<T>("length_"),
  );

  if (reusableLength != 0) {
    const dataStart = out.dataStart;
    let index = 0;

    do {
      if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
      srcStart += 2;
      if (srcStart >= srcEnd) break;
      if (load<u16>(srcStart) == BRACKET_RIGHT) {
        out.length = 0;
        return out;
      }

      if (isSigned<valueof<T>>()) {
        while (srcStart < srcEnd) {
          let negative = false;
          let code = load<u16>(srcStart);
          if (code == 45) {
            negative = true;
            srcStart += 2;
            if (srcStart >= srcEnd) break;
            code = load<u16>(srcStart);
          }

          let digit = <u32>code - 48;
          if (digit > 9) break;

          let value: u64 = digit;
          srcStart += 2;
          while (srcStart + 14 < srcEnd) {
            const next = tryParseEightDigitsSIMD(srcStart, value);
            if (!next) break;
            value = next;
            srcStart += 16;
          }
          while (srcStart < srcEnd) {
            digit = <u32>load<u16>(srcStart) - 48;
            if (digit > 9) break;
            value = value * 10 + digit;
            srcStart += 2;
          }

          if (index >= reusableLength) break;
          storeSignedInteger<T>(
            dataStart + <usize>index * sizeof<valueof<T>>(),
            negative ? -(<i64>value) : <i64>value,
          );
          index++;
          if (srcStart >= srcEnd) break;

          code = load<u16>(srcStart);
          if (code == COMMA) {
            srcStart += 2;
            continue;
          }
          if (code == BRACKET_RIGHT) {
            if (index != reusableLength) out.length = index;
            return out;
          }
          break;
        }
      } else {
        while (srcStart < srcEnd) {
          let digit = <u32>load<u16>(srcStart) - 48;
          if (digit > 9) break;

          let value: u64 = digit;
          srcStart += 2;
          while (srcStart + 14 < srcEnd) {
            const next = tryParseEightDigitsSIMD(srcStart, value);
            if (!next) break;
            value = next;
            srcStart += 16;
          }
          while (srcStart < srcEnd) {
            digit = <u32>load<u16>(srcStart) - 48;
            if (digit > 9) break;
            value = value * 10 + digit;
            srcStart += 2;
          }

          if (index >= reusableLength) break;
          storeUnsignedInteger<T>(
            dataStart + <usize>index * sizeof<valueof<T>>(),
            value,
          );
          index++;
          if (srcStart >= srcEnd) break;

          const code = load<u16>(srcStart);
          if (code == COMMA) {
            srcStart += 2;
            continue;
          }
          if (code == BRACKET_RIGHT) {
            if (index != reusableLength) out.length = index;
            return out;
          }
          break;
        }
      }
    } while (false);

    srcStart = originalSrcStart;
  }

  // Worst-case sizing: every element is at least 1 digit + 1 delimiter = 2
  // UTF-16 chars = 4 bytes. The parse helpers below store through `writePtr`
  // directly, eliminating `Array.push`'s per-element capacity check + length
  // write for every integer width.
  const elementSize = sizeof<valueof<T>>();
  const maxElements = i32((<usize>(srcEnd - srcStart)) >> 2);
  if (maxElements > 0) out.length = maxElements;
  const dataStart = out.dataStart;
  let writePtr = dataStart;

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return out;
    }

    if (isSigned<valueof<T>>()) {
      while (srcStart < srcEnd) {
        const next = parseSignedIntegerSIMD<T>(srcStart, srcEnd, writePtr);
        if (!next) break;
        writePtr += elementSize;
        srcStart = next;
        if (srcStart >= srcEnd) break;

        const code = load<u16>(srcStart);
        if (code == COMMA) {
          srcStart += 2;
          continue;
        }
        if (code == BRACKET_RIGHT) {
          out.length = i32(<usize>(writePtr - dataStart) / elementSize);
          return out;
        }
        break;
      }
    } else {
      while (srcStart < srcEnd) {
        const next = parseUnsignedIntegerSIMD<T>(srcStart, srcEnd, writePtr);
        if (!next) break;
        writePtr += elementSize;
        srcStart = next;
        if (srcStart >= srcEnd) break;

        const code = load<u16>(srcStart);
        if (code == COMMA) {
          srcStart += 2;
          continue;
        }
        if (code == BRACKET_RIGHT) {
          out.length = i32(<usize>(writePtr - dataStart) / elementSize);
          return out;
        }
        break;
      }
    }
  } while (false);

  // Fall through to SWAR's SLOW path; it resets `out.length = 0` and
  // re-parses from the original input. The pre-allocated buffer is retained
  // so SLOW's per-element `ensureArrayElementSlot` reuses the capacity.
  return deserializeIntegerArray_SLOW<T>(
    originalSrcStart,
    srcEnd,
    changetype<usize>(out),
  );
}
