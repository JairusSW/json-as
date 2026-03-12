import { JSONMode } from "../..";
import { deserializeString as deserializeString_NAIVE } from "../simple/string";
import { deserializeString_SWAR } from "../swar/string";


@inline export function deserializeString(srcStart: usize, srcEnd: usize): string {
  if (JSON_MODE == JSONMode.NAIVE) {
    return deserializeString_NAIVE(srcStart, srcEnd);
  } else {
    return deserializeString_SWAR(srcStart, srcEnd);
  }
}
