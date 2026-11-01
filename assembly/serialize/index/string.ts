import { JSONMode } from "../..";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import {
  serializeString_NAIVE,
  serializeStringRange,
  serializeStringRangeReserved,
} from "../naive/string";
import {
  serializeString_SIMD,
  serializeStringRange_SIMD,
  serializeStringRangeReserved_SIMD,
} from "../simd/string";
import {
  serializeString_SWAR,
  serializeStringRange_SWAR,
  serializeStringRangeReserved_SWAR,
} from "../swar/string";

export function serializeString(src: string): void {
  if (JSON_MODE == JSONMode.SIMD) {
    serializeString_SIMD(src);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    serializeString_NAIVE(src);
  } else {
    serializeString_SWAR(src);
  }
}


@inline
export function serializeStringPointer(src: usize): void {
  const size = changetype<OBJECT>(src - TOTAL_OVERHEAD).rtSize;
  if (JSON_MODE == JSONMode.SIMD) {
    serializeStringRange_SIMD(src, size);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    serializeStringRange(src, size);
  } else {
    serializeStringRange_SWAR(src, size);
  }
}

/** Pointer-only generated-field entry with capacity reserved by its object. */
@inline
export function serializeStringPointerReserved(src: usize): void {
  const size = changetype<OBJECT>(src - TOTAL_OVERHEAD).rtSize;
  if (JSON_MODE == JSONMode.SIMD) {
    serializeStringRangeReserved_SIMD(src, size);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    serializeStringRangeReserved(src, size);
  } else {
    serializeStringRangeReserved_SWAR(src, size);
  }
}
