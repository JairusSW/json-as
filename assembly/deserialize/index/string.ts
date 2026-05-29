import { JSONMode } from "../..";
import {
  deserializeString_NAIVE,
  deserializeStringField_NAIVE,
} from "../naive/string";
import {
  deserializeString_SIMD,
  deserializeStringField_SIMD,
} from "../simd/string";
import {
  deserializeString_SWAR,
  deserializeStringField_SWAR,
} from "../swar/string";


@inline export function deserializeString(
  srcStart: usize,
  srcEnd: usize,
): string {
  if (JSON_MODE == JSONMode.SIMD) {
    return deserializeString_SIMD(srcStart, srcEnd);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    return deserializeString_NAIVE(srcStart, srcEnd);
  } else {
    return deserializeString_SWAR(srcStart, srcEnd);
  }
}


@inline export function deserializeStringField<T extends string | null>(
  srcStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  if (JSON_MODE == JSONMode.SIMD) {
    return deserializeStringField_SIMD<T>(srcStart, srcEnd, dstFieldPtr);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    return deserializeStringField_NAIVE<T>(srcStart, srcEnd, dstFieldPtr);
  } else {
    return deserializeStringField_SWAR<T>(srcStart, srcEnd, dstFieldPtr);
  }
}
