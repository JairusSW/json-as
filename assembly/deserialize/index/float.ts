import { JSONMode } from "../..";
import {
  deserializeFloat_NAIVE,
  deserializeFloatField_NAIVE,
} from "../naive/float";
import {
  deserializeFloat_SWAR,
  deserializeFloatField_SWAR,
} from "../swar/float";
import {
  deserializeFloat_SIMD,
  deserializeFloatField_SIMD,
} from "../simd/float";
import { validateJSONNumberToken } from "../../util/validateJson";

export function deserializeFloat<T>(srcStart: usize, srcEnd: usize): T {
  if (JSON_MODE == JSONMode.SIMD) {
    return deserializeFloat_SIMD<T>(srcStart, srcEnd);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    return deserializeFloat_NAIVE<T>(srcStart, srcEnd);
  } else {
    return deserializeFloat_SWAR<T>(srcStart, srcEnd);
  }
}

export function deserializeFloatField<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  let end: usize;
  if (JSON_MODE == JSONMode.SIMD) {
    end = deserializeFloatField_SIMD<T>(srcStart, srcEnd, dstObj, dstOffset);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    end = deserializeFloatField_NAIVE<T>(srcStart, srcEnd, dstObj, dstOffset);
  } else {
    end = deserializeFloatField_SWAR<T>(srcStart, srcEnd, dstObj, dstOffset);
  }
  if (JSON_STRICT && !validateJSONNumberToken(srcStart, end)) return 0;
  return end;
}
