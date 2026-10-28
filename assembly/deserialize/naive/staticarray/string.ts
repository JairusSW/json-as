import { resizeStaticArray } from "../../../util/resizeStaticArray";
import { JSON } from "../../..";
import { QUOTE, NULL_WORD_U64 } from "../../../custom/chars";
import { isUnescapedQuote } from "../../../util";

export function deserializeStaticArrayString<T extends StaticArray<any>>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  // First pass: count elements using same logic as Array deserializer
  let count: i32 = 0;
  let ptr = srcStart;
  let inString = false;
  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (!inString && ptr + 8 <= srcEnd && load<u64>(ptr) == NULL_WORD_U64) {
      count++;
      ptr += 8;
      continue;
    }
    if (code == QUOTE) {
      if (!inString) {
        inString = true;
      } else if (isUnescapedQuote(ptr)) {
        count++;
        inString = false;
      }
    }
    ptr += 2;
  }

  // Allocate StaticArray with correct size
  const out = resizeStaticArray<T>(dst, count);

  // Second pass: populate values
  let index = 0;
  let lastPos: usize = 0;
  inString = false;
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (
      !inString &&
      srcStart + 8 <= srcEnd &&
      load<u64>(srcStart) == NULL_WORD_U64
    ) {
      unchecked((out[index++] = changetype<valueof<T>>(0)));
      srcStart += 8;
      continue;
    }
    if (code == QUOTE) {
      if (!inString) {
        inString = true;
        lastPos = srcStart;
      } else if (isUnescapedQuote(srcStart)) {
        unchecked(
          (out[index++] = changetype<valueof<T>>(
            JSON.__deserialize<string>(lastPos, srcStart + 2),
          )),
        );
        inString = false;
      }
    }
    srcStart += 2;
  }

  return out;
}
