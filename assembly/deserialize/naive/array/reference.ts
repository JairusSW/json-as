import { JSON } from "../../..";
import {
  BRACE_LEFT,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  COMMA,
  NULL_WORD_U64,
} from "../../../custom/chars";
import { isSpace } from "../../../util";
import { markProductionParseError } from "../../error";
import { deserializeMapBody } from "../map";
import { parseObjectBody } from "../object";

// Maps and dynamic objects report their own end cursor, preserving the direct
// single-pass path while sharing framing, null handling and output replacement.
export function deserializeReferenceArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<T>(dst || changetype<usize>(instantiate<T>()));
  out.length = 0;
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
  if (srcStart < srcEnd && load<u16>(srcStart) == BRACKET_LEFT) {
    srcStart += 2;
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart + 2 == srcEnd && load<u16>(srcStart) == BRACKET_RIGHT)
      return out;
    while (srcStart < srcEnd) {
      let value = changetype<valueof<T>>(0);
      if (
        isNullable<valueof<T>>() &&
        srcStart + 8 <= srcEnd &&
        load<u64>(srcStart) == NULL_WORD_U64
      ) {
        value = changetype<valueof<T>>(0);
        srcStart += 8;
      } else if (load<u16>(srcStart) == BRACE_LEFT) {
        if (changetype<nonnull<valueof<T>>>(0) instanceof JSON.Obj) {
          const object = new JSON.Obj();
          srcStart = parseObjectBody(object, srcStart + 2, srcEnd);
          value = changetype<valueof<T>>(object);
        } else {
          const map = instantiate<nonnull<valueof<T>>>();
          srcStart = deserializeMapBody<nonnull<valueof<T>>>(
            srcStart,
            srcEnd,
            map,
          );
          value = changetype<valueof<T>>(map);
        }
        if (!srcStart) break;
      } else break;
      out.push(value);
      while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
      if (srcStart >= srcEnd) break;
      if (load<u16>(srcStart) == BRACKET_RIGHT && srcStart + 2 == srcEnd)
        return out;
      if (load<u16>(srcStart) != COMMA) break;
      srcStart += 2;
      while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    }
  }
  markProductionParseError();
  return changetype<T>(0);
}
