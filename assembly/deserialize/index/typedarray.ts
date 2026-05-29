import { JSONMode } from "../..";
import {
  deserializeArrayBuffer_NAIVE,
  deserializeTypedArray_NAIVE,
} from "../naive/typedarray";
import {
  deserializeArrayBuffer_SWAR,
  deserializeTypedArray_SWAR,
} from "../swar/typedarray";

// SWAR/SIMD modes share the same SWAR-only fast path: a single
// comma-count pass plus inline parsing. The NAIVE path keeps the
// scalar double-pass implementation for compat.

export function deserializeTypedArray<T extends ArrayLike<number>>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize = 0,
): T {
  if (JSON_MODE == JSONMode.SWAR || JSON_MODE == JSONMode.SIMD) {
    return deserializeTypedArray_SWAR<T>(srcStart, srcEnd, dst);
  }
  return deserializeTypedArray_NAIVE<T>(srcStart, srcEnd, dst);
}

export function deserializeArrayBuffer(
  srcStart: usize,
  srcEnd: usize,
  dst: usize = 0,
): ArrayBuffer {
  if (JSON_MODE == JSONMode.SWAR || JSON_MODE == JSONMode.SIMD) {
    return deserializeArrayBuffer_SWAR(srcStart, srcEnd, dst);
  }
  return deserializeArrayBuffer_NAIVE(srcStart, srcEnd, dst);
}
