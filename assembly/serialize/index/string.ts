import { JSONMode } from "../..";
import { serializeString as serializeString_NAIVE } from "../simple/string";
import { serializeString_SIMD } from "../simd/string";
import { serializeString_SWAR } from "../swar/string";


@inline export function serializeString(src: string): void {
  if (JSON_MODE == JSONMode.SIMD) {
    serializeString_SIMD(src);
  } else if (JSON_MODE == JSONMode.NAIVE) {
    serializeString_NAIVE(src);
  } else {
    serializeString_SWAR(src);
  }
}
