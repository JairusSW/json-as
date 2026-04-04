import { JSON } from "../../..";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { isSpace } from "../../../util";
import { scanValueEnd } from "../../swar/array/shared";

export function deserializeGenericArray<T extends unknown[]>(srcStart: usize, srcEnd: usize, dst: usize): T {
  const out = changetype<nonnull<T>>(dst || changetype<usize>(instantiate<T>()));
  out.length = 0;

  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  if (srcStart >= srcEnd) throw new Error("Input string had zero length or was all whitespace");
  if (load<u16>(srcStart) != BRACKET_LEFT) throw new Error("Expected '[' at start of array");
  srcStart += 2;

  while (srcStart < srcEnd) {
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;

    if (load<u16>(srcStart) == BRACKET_RIGHT) return out;

    const valueEnd = scanValueEnd(srcStart, srcEnd);
    if (!valueEnd || valueEnd <= srcStart) break;

    out.push(JSON.__deserialize<valueof<T>>(srcStart, valueEnd));
    srcStart = valueEnd;

    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;

    const code = load<u16>(srcStart);
    if (code == COMMA) {
      srcStart += 2;
      continue;
    }
    if (code == BRACKET_RIGHT) return out;
    break;
  }

  throw new Error("Failed to parse JSON!");
}
