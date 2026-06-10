import { BRACE_LEFT, BRACKET_LEFT, BRACKET_RIGHT } from "../../../custom/chars";
import { JSON } from "../../..";
import { isSpace } from "util/string";
import { deserializeMapBody } from "../map";

export function deserializeMapArray<T extends Map<any, any>[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );

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

  // Each `{...}` map element is parsed in a single pass via deserializeMapBody,
  // which reports where it ended - no separate scan to find the closing brace.
  while (srcStart < srcEnd) {
    if (load<u16>(srcStart) == BRACE_LEFT) {
      const m = instantiate<valueof<T>>();
      srcStart = deserializeMapBody<valueof<T>>(srcStart, srcEnd, m);
      out.push(m);
    } else {
      srcStart += 2;
    }
  }
  return out;
}
