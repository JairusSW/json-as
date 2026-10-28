import { resizeStaticArray } from "../../../util/resizeStaticArray";
import { isSpace } from "../../../util";
import {
  BRACKET_LEFT,
  BRACKET_RIGHT,
  COMMA,
  FALSE_WORD_U64,
  TRUE_WORD_U64,
} from "../../../custom/chars";
import { markProductionParseError } from "../../error";
export function deserializeStaticArrayBoolean<T extends StaticArray<any>>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
  if (
    srcStart >= srcEnd ||
    load<u16>(srcStart) != BRACKET_LEFT ||
    load<u16>(srcEnd - 2) != BRACKET_RIGHT
  ) {
    markProductionParseError();
    return changetype<T>(0);
  }

  const bodyStart = srcStart + 2;
  const bodyEnd = srcEnd - 2;
  let ptr = bodyStart;
  while (ptr < bodyEnd && isSpace(load<u16>(ptr))) ptr += 2;
  if (ptr == bodyEnd) return resizeStaticArray<T>(dst, 0);

  // A compact `true,` element occupies at least ten UTF-16 bytes. Allocate
  // that safe upper bound, validate and populate in one pass, then shrink.
  const maxCount = i32((bodyEnd - ptr + 2) / 10);
  let out = resizeStaticArray<T>(dst, maxCount);
  let index = 0;
  while (true) {
    if (ptr + 8 <= bodyEnd && load<u64>(ptr) == TRUE_WORD_U64) {
      unchecked((out[index] = <valueof<T>>true));
      ptr += 8;
    } else if (
      ptr + 10 <= bodyEnd &&
      load<u64>(ptr) == FALSE_WORD_U64 &&
      load<u16>(ptr, 8) == 101
    ) {
      unchecked((out[index] = <valueof<T>>false));
      ptr += 10;
    } else {
      markProductionParseError();
      return changetype<T>(0);
    }
    index++;
    while (ptr < bodyEnd && isSpace(load<u16>(ptr))) ptr += 2;
    if (ptr == bodyEnd)
      return resizeStaticArray<T>(changetype<usize>(out), index);
    if (ptr >= bodyEnd || load<u16>(ptr) != COMMA) {
      markProductionParseError();
      return changetype<T>(0);
    }
    ptr += 2;
    while (ptr < bodyEnd && isSpace(load<u16>(ptr))) ptr += 2;
    if (ptr == bodyEnd) {
      markProductionParseError();
      return changetype<T>(0);
    }
  }
}
