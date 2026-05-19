// Back-compat shim. The canonical fast SWAR atoi/atou implementations live
// in `deserialize/swar/integer.ts`, using the full tiered stride hierarchy
// (parse16 -> parse8 -> parse4 -> scalar). These thin wrappers preserve the
// original `(srcStart, srcEnd, [dstPtr])` signatures used by existing tests
// and benches.

import {
  deserializeInteger_SWAR,
  deserializeIntegerField_SWAR,
  deserializeUnsigned_SWAR,
  deserializeUnsignedField_SWAR,
} from "../deserialize/swar/integer";

/**
 * Parse an unsigned integer by consuming the whole range as digits.
 *
 * @param srcStart Pointer to the first UTF-16 code unit.
 * @param srcEnd   Pointer just past the last code unit.
 * @returns The parsed value, truncated to `T`.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function atou<T extends number>(
  srcStart: usize,
  srcEnd: usize,
): T {
  return deserializeUnsigned_SWAR<T>(srcStart, srcEnd);
}

/**
 * Parse a signed integer by consuming the whole range as digits, with an
 * optional leading `-`.
 *
 * @param srcStart Pointer to the first UTF-16 code unit.
 * @param srcEnd   Pointer just past the last code unit.
 * @returns The parsed value, truncated to `T`.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function atoi<T extends number>(
  srcStart: usize,
  srcEnd: usize,
): T {
  return deserializeInteger_SWAR<T>(srcStart, srcEnd);
}

/**
 * Scan an unsigned integer, stopping at the first non-digit. Writes the
 * parsed value through `dstPtr` and returns the source position immediately
 * after the last digit.
 *
 * @param srcStart Pointer to the first UTF-16 code unit.
 * @param srcEnd   Pointer just past the last code unit.
 * @param dstPtr   Destination pointer for the parsed value.
 * @returns The source position immediately after the last digit consumed.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function atouScan<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstPtr: usize,
): usize {
  return deserializeUnsignedField_SWAR<T>(srcStart, srcEnd, dstPtr, 0);
}

/**
 * Scan a signed integer, stopping at the first non-digit. Handles an
 * optional leading `-`. Writes the parsed value through `dstPtr` and
 * returns the source position immediately after the last digit.
 *
 * @param srcStart Pointer to the first UTF-16 code unit.
 * @param srcEnd   Pointer just past the last code unit.
 * @param dstPtr   Destination pointer for the parsed value.
 * @returns The source position immediately after the last digit consumed.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function atoiScan<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstPtr: usize,
): usize {
  return deserializeIntegerField_SWAR<T>(srcStart, srcEnd, dstPtr, 0);
}
