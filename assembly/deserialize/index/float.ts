import { JSONMode } from "../..";
import {
  deserializeFloat as deserializeFloat_NAIVE,
  deserializeFloatField as deserializeFloatField_NAIVE,
} from "../simple/float";
import {
  deserializeFloat_SWAR,
  deserializeFloatField_SWAR,
} from "../swar/float";
import {
  deserializeFloat_SIMD,
  deserializeFloatField_SIMD,
} from "../simd/float";

// @ts-ignore: inline
@inline export function deserializeFloat<T>(srcStart: usize, srcEnd: usize): T {
  if (JSON_MODE == JSONMode.SIMD) {
    return deserializeFloat_SIMD<T>(srcStart, srcEnd);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    return deserializeFloat_NAIVE<T>(srcStart, srcEnd);
  } else {
    return deserializeFloat_SWAR<T>(srcStart, srcEnd);
  }
}

// @ts-ignore: inline
@inline export function deserializeFloatField<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  if (JSON_MODE == JSONMode.SIMD) {
    return deserializeFloatField_SIMD<T>(srcStart, srcEnd, dstObj, dstOffset);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    return deserializeFloatField_NAIVE<T>(srcStart, srcEnd, dstObj, dstOffset);
  } else {
    return deserializeFloatField_SWAR<T>(srcStart, srcEnd, dstObj, dstOffset);
  }
}
