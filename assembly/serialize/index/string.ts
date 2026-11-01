import { JSONMode } from "../..";
import { bs } from "../../../lib/as-bs";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import {
  serializeString_NAIVE,
  serializeStringRange,
  serializeStringRangeReserved,
} from "../naive/string";
import {
  serializeString_SIMD,
  serializeStringPointerReservedAt_SIMD,
  serializeStringRangeReserved_SIMD,
  serializeShortStringReservedAt_SIMD,
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
  if (JSON_MODE == JSONMode.SIMD) {
    serializeString_SIMD(changetype<string>(src));
  } else if (JSON_MODE == JSONMode.NAIVE) {
    const size = changetype<OBJECT>(src - TOTAL_OVERHEAD).rtSize;
    serializeStringRange(src, size);
  } else {
    const size = changetype<OBJECT>(src - TOTAL_OVERHEAD).rtSize;
    serializeStringRange_SWAR(src, size);
  }
}

/** Pointer-only generated-field entry with capacity reserved by its object. */
@inline
export function serializeStringPointerReserved(src: usize): void {
  if (JSON_MODE == JSONMode.SIMD) {
    bs.offset = serializeStringPointerReservedAt_SIMD(src, bs.offset);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    const size = changetype<OBJECT>(src - TOTAL_OVERHEAD).rtSize;
    serializeStringRangeReserved(src, size);
  } else {
    const size = changetype<OBJECT>(src - TOTAL_OVERHEAD).rtSize;
    serializeStringRangeReserved_SWAR(src, size);
  }
}

/** Cursor-returning generated-field entry. SIMD keeps clean output entirely
 * local; other backends preserve their established shared-builder path. */
@inline
export function serializeStringPointerReservedAt(
  dst: usize,
  src: usize,
): usize {
  if (JSON_MODE == JSONMode.SIMD) {
    const size = changetype<OBJECT>(src - TOTAL_OVERHEAD).rtSize;
    if (size < 16) return serializeShortStringReservedAt_SIMD(src, size, dst);
    return serializeStringPointerReservedAt_SIMD(src, dst);
  }
  const size = changetype<OBJECT>(src - TOTAL_OVERHEAD).rtSize;
  bs.offset = dst;
  if (JSON_MODE == JSONMode.NAIVE) {
    serializeStringRangeReserved(src, size);
  } else {
    serializeStringRangeReserved_SWAR(src, size);
  }
  return bs.offset;
}
