import {
  BRACE_LEFT,
  BRACE_RIGHT,
  BRACKET_LEFT,
  BRACKET_RIGHT,
} from "../../../custom/chars";
import { JSON } from "../../..";
import { isSpace } from "util/string";

export function deserializeStructArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );
  let lastIndex: usize = 0;
  let depth: u32 = 0;

  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  if (srcStart - srcEnd == 0)
    throw new Error("Input string had zero length or was all whitespace");

  if (load<u16>(srcStart) != BRACKET_LEFT)
    throw new Error(
      "Expected '[' at start of object at position " +
        (srcEnd - srcStart).toString(),
    );
  if (load<u16>(srcEnd - 2) != BRACKET_RIGHT)
    throw new Error(
      "Expected ']' at end of object at position " +
        (srcEnd - srcStart).toString(),
    );

  // Reuse existing element slots when `dst` already holds elements (no per-call
  // allocation on a reused array); fall back to push for fresh/extra slots and
  // trim any leftovers from a previous, longer parse.
  let index = 0;
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code == BRACE_LEFT && depth++ == 0) {
      lastIndex = srcStart;
    } else if (code == BRACE_RIGHT && --depth == 0) {
      const valueEnd = (srcStart += 2);
      if (<usize>index < <usize>out.length) {
        const slot = changetype<usize>(unchecked(out[index]));
        if (slot != 0) {
          JSON.__deserialize<valueof<T>>(lastIndex, valueEnd, slot);
        } else {
          unchecked(
            (out[index] = JSON.__deserialize<valueof<T>>(lastIndex, valueEnd)),
          );
        }
      } else {
        out.push(JSON.__deserialize<valueof<T>>(lastIndex, valueEnd));
      }
      index++;
    }
    srcStart += 2;
  }
  if (<usize>index < <usize>out.length) out.length = index;
  return out;
}
