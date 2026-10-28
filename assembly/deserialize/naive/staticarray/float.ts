import { resizeStaticArray } from "../../../util/resizeStaticArray";
import { isSpace } from "../../../util";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { JSON } from "../../..";
import { markProductionParseError } from "../../error";
import {
  validateJSONNumberToken,
  validateJSONNumberTokenLoose,
} from "../../../util/validateJson";

export function deserializeStaticArrayFloat<T extends StaticArray<any>>(
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

  let count = 0;
  while (true) {
    const tokenStart = ptr;
    while (ptr < bodyEnd) {
      const code = load<u16>(ptr);
      if (code == COMMA || isSpace(code)) break;
      ptr += 2;
    }
    const valid = JSON_STRICT
      ? validateJSONNumberToken(tokenStart, ptr)
      : validateJSONNumberTokenLoose(tokenStart, ptr);
    if (!valid) {
      markProductionParseError();
      return changetype<T>(0);
    }
    count++;
    while (ptr < bodyEnd && isSpace(load<u16>(ptr))) ptr += 2;
    if (ptr == bodyEnd) break;
    if (load<u16>(ptr) != COMMA) {
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

  const out = resizeStaticArray<T>(dst, count);
  ptr = bodyStart;
  for (let index = 0; index < count; index++) {
    while (ptr < bodyEnd && isSpace(load<u16>(ptr))) ptr += 2;
    const tokenStart = ptr;
    while (ptr < bodyEnd) {
      const code = load<u16>(ptr);
      if (code == COMMA || isSpace(code)) break;
      ptr += 2;
    }
    unchecked((out[index] = JSON.__deserialize<valueof<T>>(tokenStart, ptr)));
    while (ptr < bodyEnd && isSpace(load<u16>(ptr))) ptr += 2;
    if (index + 1 < count) ptr += 2;
  }
  return out;
}
