import { JSONMode } from "../..";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { serializeString_NAIVE, serializeStringRange } from "../naive/string";
import {
  serializeString_SIMD,
  serializeStringRange_SIMD,
} from "../simd/string";
import {
  serializeString_SWAR,
  serializeStringRange_SWAR,
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
