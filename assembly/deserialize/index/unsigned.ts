import { JSONMode } from "../..";
import {
  deserializeUnsigned as deserializeUnsigned_NAIVE,
  deserializeUnsignedField as deserializeUnsignedField_NAIVE,
} from "../simple/unsigned";
import {
  deserializeUnsigned_SWAR,
  deserializeUnsignedField_SWAR,
} from "../swar/integer";
import {
  deserializeUnsigned_SIMD,
  deserializeUnsignedField_SIMD,
} from "../simd/integer";

/**
 * Compile-time dispatch for {@link deserializeUnsigned_NAIVE},
 * {@link deserializeUnsigned_SWAR}, and {@link deserializeUnsigned_SIMD}
 * based on `JSON_MODE`.
 *
 * @param srcStart Pointer to the first UTF-16 code unit.
 * @param srcEnd   Pointer just past the last code unit.
 * @returns The parsed value, truncated to `T`.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function deserializeUnsigned<T extends number>(
  srcStart: usize,
  srcEnd: usize,
): T {
  if (JSON_MODE == JSONMode.SIMD) {
    return deserializeUnsigned_SIMD<T>(srcStart, srcEnd);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    return deserializeUnsigned_NAIVE<T>(srcStart, srcEnd);
  } else {
    return deserializeUnsigned_SWAR<T>(srcStart, srcEnd);
  }
}

/**
 * Compile-time dispatch for {@link deserializeUnsignedField_NAIVE},
 * {@link deserializeUnsignedField_SWAR}, and
 * {@link deserializeUnsignedField_SIMD} based on `JSON_MODE`.
 *
 * @param srcStart  Pointer to the first UTF-16 code unit.
 * @param srcEnd    Pointer just past the last code unit.
 * @param dstObj    Destination object pointer.
 * @param dstOffset Byte offset of the field within `dstObj`.
 * @returns The source position immediately after the last digit consumed.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function deserializeUnsignedField<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  if (JSON_MODE == JSONMode.SIMD) {
    return deserializeUnsignedField_SIMD<T>(
      srcStart,
      srcEnd,
      dstObj,
      dstOffset,
    );
  } else if (JSON_MODE == JSONMode.NAIVE) {
    return deserializeUnsignedField_NAIVE<T>(
      srcStart,
      srcEnd,
      dstObj,
      dstOffset,
    );
  } else {
    return deserializeUnsignedField_SWAR<T>(
      srcStart,
      srcEnd,
      dstObj,
      dstOffset,
    );
  }
}
