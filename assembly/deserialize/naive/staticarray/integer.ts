import { resizeStaticArray } from "../../../util/resizeStaticArray";
import { atoi, isSpace } from "../../../util";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { markProductionParseError } from "../../error";
import { countArrayElements } from "../../../util/countArrayElements";

export function deserializeStaticArrayInteger<T extends StaticArray<any>>(
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

  const count = ptr == bodyEnd ? 0 : countArrayElements(ptr, bodyEnd);
  const out = resizeStaticArray<T>(dst, count);
  const signed = isSigned<valueof<T>>();
  ptr = bodyStart;
  for (let index = 0; index < count; index++) {
    while (ptr < bodyEnd && isSpace(load<u16>(ptr))) ptr += 2;
    const tokenStart = ptr;
    if (ptr >= bodyEnd) {
      markProductionParseError();
      return changetype<T>(0);
    }
    if (load<u16>(ptr) == 45) {
      if (!signed) {
        markProductionParseError();
        return changetype<T>(0);
      }
      ptr += 2;
    }
    if (ptr >= bodyEnd) {
      markProductionParseError();
      return changetype<T>(0);
    }
    const first = <u32>(load<u16>(ptr) - 48);
    if (first > 9) {
      markProductionParseError();
      return changetype<T>(0);
    }
    ptr += 2;
    if (
      JSON_STRICT &&
      first == 0 &&
      ptr < bodyEnd &&
      <u32>(load<u16>(ptr) - 48) <= 9
    ) {
      markProductionParseError();
      return changetype<T>(0);
    }
    while (ptr < bodyEnd && <u32>(load<u16>(ptr) - 48) <= 9) ptr += 2;
    unchecked((out[index] = atoi<valueof<T>>(tokenStart, ptr)));

    while (ptr < bodyEnd && isSpace(load<u16>(ptr))) ptr += 2;
    if (index + 1 == count) {
      if (ptr == bodyEnd) return out;
      markProductionParseError();
      return changetype<T>(0);
    }
    if (ptr >= bodyEnd || load<u16>(ptr) != COMMA) {
      markProductionParseError();
      return changetype<T>(0);
    }
    ptr += 2;
  }
  return out;
}
