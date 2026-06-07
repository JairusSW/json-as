// SWAR integer deserializers (signed + unsigned) over UTF-16 sources.
//
// Consume-to-end paths use the full tiered stride hierarchy:
//
// - parse16 (32 bytes / 16 digits): best for long inputs
// - parse8  (16 bytes /  8 digits)
// - parse4  ( 8 bytes /  4 digits)
// - scalar  ( 2 bytes /  1 digit )
//
// Scan paths use asymmetric tuning based on empirical h2h benches:
//
// - Unsigned scan: parse8 + scalar (no parse4). For unsigned inputs the
//   digit run is aligned, so parse8 either succeeds cleanly or terminates
//   early. The intermediate parse4 stride costs more in wasted-validate
//   than it saves in successful work.
// - Signed scan: parse4 + scalar (no parse8). The leading minus consumes
//   2 bytes, shifting the digit run into parse8's "terminator-in-load"
//   zone where validate-fail is common. parse4 is a smaller failure unit.
//
// parse16 is omitted from scan entirely: a 16-character digit run plus
// terminator fits in its 32-byte load, so the terminator triggers a wasted
// validate-fail at the boundary.

import {
  parse4Digits_PairMul,
  parse4Digits_PairMul_Unsafe,
  parse8Digits_PairMul,
  parse8Digits_PairMul_Unsafe,
  parse16Digits_SWAR,
  parse16Digits_SWAR_Unsafe,
} from "../../util/swar-int";

const ASCII_MINUS: u16 = 45;
const ASCII_ZERO: u16 = 48;

/**
 * Store a signed value into a typed integer field, truncating to `T`'s width.
 *
 * @param dstPtr Destination pointer (already includes any field offset).
 * @param value  The `u64` accumulator, interpreted as a two's-complement
 *               signed integer for narrower types.
 */
function storeSignedToField<T extends number>(dstPtr: usize, value: u64): void {
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
function storeUnsignedToField<T extends number>(
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
 * Caller guarantees the range is well-formed (optional minus followed by
 * digits only). Uses the unsafe SWAR kernels with no per-stride validation.
 *
 * @param srcStart Pointer to the first UTF-16 code unit.
 * @param srcEnd   Pointer just past the last code unit.
 * @returns The parsed value, two's-complement truncated to `T`.
 */
export function deserializeInteger_SWAR<T extends number>(
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
      value * 10_000_000_000_000_000 + parse16Digits_SWAR_Unsafe(srcStart);
    srcStart += 32;
  }
  while (srcStart + 14 < srcEnd) {
    value =
      value * 100_000_000 +
      parse8Digits_PairMul_Unsafe(load<u64>(srcStart), load<u64>(srcStart, 8));
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
 * Used by struct field deserializers, where the digit run is followed by
 * a `,`, `}`, `]`, whitespace, etc.
 *
 * @param srcStart  Pointer to the first UTF-16 code unit.
 * @param srcEnd    Pointer just past the last code unit.
 * @param dstObj    Destination object pointer.
 * @param dstOffset Byte offset of the field within `dstObj`.
 * @returns The source position immediately after the last digit consumed.
 */
export function deserializeIntegerField_SWAR<T extends number>(
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
 * Caller guarantees the range is digits only. Uses the unsafe SWAR kernels
 * with no per-stride validation.
 *
 * @param srcStart Pointer to the first UTF-16 code unit.
 * @param srcEnd   Pointer just past the last code unit.
 * @returns The parsed value, truncated to `T`.
 */
export function deserializeUnsigned_SWAR<T extends number>(
  srcStart: usize,
  srcEnd: usize,
): T {
  let value: u64 = 0;
  while (srcStart + 30 < srcEnd) {
    value =
      value * 10_000_000_000_000_000 + parse16Digits_SWAR_Unsafe(srcStart);
    srcStart += 32;
  }
  while (srcStart + 14 < srcEnd) {
    value =
      value * 100_000_000 +
      parse8Digits_PairMul_Unsafe(load<u64>(srcStart), load<u64>(srcStart, 8));
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
export function deserializeUnsignedField_SWAR<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  let value: u64 = 0;
  // Unsigned scan uses parse8 + scalar only (see file header).
  while (srcStart + 14 < srcEnd) {
    const parsed = parse8Digits_PairMul(
      load<u64>(srcStart),
      load<u64>(srcStart, 8),
    );
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
