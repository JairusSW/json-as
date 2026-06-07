import { JSONMode } from "../..";
import {
  deserializeInteger_NAIVE,
  deserializeIntegerField_NAIVE,
} from "../naive/integer";
import {
  deserializeInteger_SWAR,
  deserializeIntegerField_SWAR,
} from "../swar/integer";
import {
  deserializeInteger_SIMD,
  deserializeIntegerField_SIMD,
} from "../simd/integer";

/**
 * Compile-time dispatch for {@link deserializeInteger_NAIVE},
 * {@link deserializeInteger_SWAR}, and {@link deserializeInteger_SIMD}
 * based on `JSON_MODE`.
 *
 * @param srcStart Pointer to the first UTF-16 code unit.
 * @param srcEnd   Pointer just past the last code unit.
 * @returns The parsed value, truncated to `T`.
 */
export function deserializeInteger<T extends number>(
  srcStart: usize,
  srcEnd: usize,
): T {
  if (JSON_MODE == JSONMode.SIMD) {
    return deserializeInteger_SIMD<T>(srcStart, srcEnd);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    return deserializeInteger_NAIVE<T>(srcStart, srcEnd);
  } else {
    return deserializeInteger_SWAR<T>(srcStart, srcEnd);
  }
}

/**
 * Compile-time dispatch for {@link deserializeIntegerField_NAIVE},
 * {@link deserializeIntegerField_SWAR}, and
 * {@link deserializeIntegerField_SIMD} based on `JSON_MODE`.
 *
 * @param srcStart  Pointer to the first UTF-16 code unit.
 * @param srcEnd    Pointer just past the last code unit.
 * @param dstObj    Destination object pointer.
 * @param dstOffset Byte offset of the field within `dstObj`.
 * @returns The source position immediately after the last digit consumed.
 */
export function deserializeIntegerField<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  if (JSON_MODE == JSONMode.SIMD) {
    return deserializeIntegerField_SIMD<T>(srcStart, srcEnd, dstObj, dstOffset);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    return deserializeIntegerField_NAIVE<T>(
      srcStart,
      srcEnd,
      dstObj,
      dstOffset,
    );
  } else {
    return deserializeIntegerField_SWAR<T>(srcStart, srcEnd, dstObj, dstOffset);
  }
}
