// SIMD integer deserializers (signed + unsigned) over UTF-16 sources.
//
// Consume-to-end paths use the full tiered hierarchy:
//
// - parse16_SIMD (32 bytes / 16 digits): best for long inputs
// - parse8_SIMD  (16 bytes /  8 digits)
// - parse4_SWAR  ( 8 bytes /  4 digits): SWAR is fine for short tails
// - scalar       ( 2 bytes /  1 digit )
//
// Scan paths use the same asymmetric tuning as the SWAR version:
//
// - Unsigned scan: parse8_SIMD + scalar (no parse4).
// - Signed scan: parse4_SWAR + scalar (no parse8). After the leading
//   minus, the digit run lands in parse8's "terminator-in-load" boundary
//   zone.
//
// Requires `--enable simd` at compile time. Dead-code-eliminated when
// JSON_MODE != SIMD.

import {
  parse4Digits_PairMul,
  parse4Digits_PairMul_Unsafe,
} from "../../util/swar-int";
import {
  parse8Digits_SIMD,
  parse8Digits_SIMD_Unsafe,
  parse16Digits_SIMD,
  parse16Digits_SIMD_Unsafe,
} from "../../util/simd-int";

const ASCII_MINUS: u16 = 45;
const ASCII_ZERO: u16 = 48;

/**
 * Store a signed value into a typed integer field, truncating to `T`'s width.
 *
 * @param dstPtr Destination pointer (already includes any field offset).
 * @param value  The `u64` accumulator, interpreted as a two's-complement
 *               signed integer for narrower types.
 */
// @ts-expect-error: @inline is a valid decorator
@inline function storeSignedToField<T extends number>(
  dstPtr: usize,
  value: u64,
): void {
  if (sizeof<T>() == 1) {
    store<i8>(dstPtr, <i8>value);
  } else if (sizeof<T>() == 2) {
    store<i16>(dstPtr, <i16>value);
  } else if (sizeof<T>() == 4) {
    store<i32>(dstPtr, <i32>value);
  } else {
    store<i64>(dstPtr, <i64>value);
  }
}

/**
 * Store an unsigned value into a typed integer field, truncating to `T`'s
 * width.
 *
 * @param dstPtr Destination pointer (already includes any field offset).
 * @param value  The `u64` accumulator.
 */
// @ts-expect-error: decorator valid here
@inline function storeUnsignedToField<T extends number>(
  dstPtr: usize,
  value: u64,
): void {
  if (sizeof<T>() == 1) {
    store<u8>(dstPtr, <u8>value);
  } else if (sizeof<T>() == 2) {
    store<u16>(dstPtr, <u16>value);
  } else if (sizeof<T>() == 4) {
    store<u32>(dstPtr, <u32>value);
  } else {
    store<u64>(dstPtr, value);
  }
}

/**
 * Parse a signed integer by consuming the entire `[srcStart, srcEnd)` range
 * as a digit run, with an optional leading `-`.
 *
 * Caller guarantees the range is well-formed. Uses the unsafe SIMD kernels
 * with no per-stride validation.
 *
 * @param srcStart Pointer to the first UTF-16 code unit.
 * @param srcEnd   Pointer just past the last code unit.
 * @returns The parsed value, two's-complement truncated to `T`.
 */
export function deserializeInteger_SIMD<T extends number>(
  srcStart: usize,
  srcEnd: usize,
): T {
  let negative = false;
  if (srcStart < srcEnd && load<u16>(srcStart) == ASCII_MINUS) {
    negative = true;
    srcStart += 2;
  }
  let value: u64 = 0;
  while (srcStart + 30 < srcEnd) {
    value =
      value * 10_000_000_000_000_000 + parse16Digits_SIMD_Unsafe(srcStart);
    srcStart += 32;
  }
  while (srcStart + 14 < srcEnd) {
    value = value * 100_000_000 + parse8Digits_SIMD_Unsafe(srcStart);
    srcStart += 16;
  }
  while (srcStart + 6 < srcEnd) {
    value = value * 10_000 + parse4Digits_PairMul_Unsafe(load<u64>(srcStart));
    srcStart += 8;
  }
  while (srcStart < srcEnd) {
    value = value * 10 + (<u32>load<u16>(srcStart) - ASCII_ZERO);
    srcStart += 2;
  }
  return <T>(negative ? 0 - value : value);
}

/**
 * Scan for a signed integer field, stopping at the first non-digit
 * character. Writes the parsed value through `dstObj + dstOffset` and
 * returns the source position immediately after the last digit.
 *
 * @param srcStart  Pointer to the first UTF-16 code unit.
 * @param srcEnd    Pointer just past the last code unit.
 * @param dstObj    Destination object pointer.
 * @param dstOffset Byte offset of the field within `dstObj`.
 * @returns The source position immediately after the last digit consumed.
 */
export function deserializeIntegerField_SIMD<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  let negative = false;
  if (srcStart < srcEnd && load<u16>(srcStart) == ASCII_MINUS) {
    negative = true;
    srcStart += 2;
  }
  let value: u64 = 0;
  // Signed scan uses parse4 + scalar only (see file header).
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_PairMul(load<u64>(srcStart));
    if (parsed == U32.MAX_VALUE) break;
    value = value * 10_000 + parsed;
    srcStart += 8;
  }
  while (srcStart < srcEnd) {
    const digit = <u32>load<u16>(srcStart) - ASCII_ZERO;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }
  storeSignedToField<T>(dstObj + dstOffset, negative ? 0 - value : value);
  return srcStart;
}

/**
 * Parse an unsigned integer by consuming the entire `[srcStart, srcEnd)`
 * range as a digit run.
 *
 * Caller guarantees the range is digits only. Uses the unsafe SIMD kernels.
 *
 * @param srcStart Pointer to the first UTF-16 code unit.
 * @param srcEnd   Pointer just past the last code unit.
 * @returns The parsed value, truncated to `T`.
 */
export function deserializeUnsigned_SIMD<T extends number>(
  srcStart: usize,
  srcEnd: usize,
): T {
  let value: u64 = 0;
  while (srcStart + 30 < srcEnd) {
    value =
      value * 10_000_000_000_000_000 + parse16Digits_SIMD_Unsafe(srcStart);
    srcStart += 32;
  }
  while (srcStart + 14 < srcEnd) {
    value = value * 100_000_000 + parse8Digits_SIMD_Unsafe(srcStart);
    srcStart += 16;
  }
  while (srcStart + 6 < srcEnd) {
    value = value * 10_000 + parse4Digits_PairMul_Unsafe(load<u64>(srcStart));
    srcStart += 8;
  }
  while (srcStart < srcEnd) {
    value = value * 10 + (<u32>load<u16>(srcStart) - ASCII_ZERO);
    srcStart += 2;
  }
  return <T>value;
}

/**
 * Scan for an unsigned integer field, stopping at the first non-digit
 * character. Writes the parsed value through `dstObj + dstOffset` and
 * returns the source position immediately after the last digit.
 *
 * @param srcStart  Pointer to the first UTF-16 code unit.
 * @param srcEnd    Pointer just past the last code unit.
 * @param dstObj    Destination object pointer.
 * @param dstOffset Byte offset of the field within `dstObj`.
 * @returns The source position immediately after the last digit consumed.
 */
export function deserializeUnsignedField_SIMD<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  let value: u64 = 0;
  // Unsigned scan uses parse8 + scalar only (see file header).
  while (srcStart + 14 < srcEnd) {
    const parsed = parse8Digits_SIMD(srcStart);
    if (parsed == U32.MAX_VALUE) break;
    value = value * 100_000_000 + parsed;
    srcStart += 16;
  }
  while (srcStart < srcEnd) {
    const digit = <u32>load<u16>(srcStart) - ASCII_ZERO;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }
  storeUnsignedToField<T>(dstObj + dstOffset, value);
  return srcStart;
}
