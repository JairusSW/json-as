import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { JSON } from "../../../";
import { isSpace } from "../../../util";
import { scanValueEnd } from "../../../util/scanValueEnd";
import { parseArrayBody } from "../object";

export function deserializeArrayArray<T extends unknown[][]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );

  // Keep dynamic inner arrays on their single-pass materialization path.
  let arbitraryInner = false;
  if (isManaged<valueof<valueof<T>>>() || isReference<valueof<valueof<T>>>()) {
    // @ts-ignore: instanceof on the (reference) inner element type
    arbitraryInner =
      changetype<nonnull<valueof<valueof<T>>>>(0) instanceof JSON.Value;
  }

  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
  if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT)
    throw new Error("Expected '[' at start of array");
  srcStart += 2;

  let index = 0;
  while (srcStart < srcEnd) {
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      if (srcStart + 2 != srcEnd) break;
      out.length = index;
      return out;
    }

    // Preserve fresh inner-array allocation: existing outer slots may alias
    // the same inner array but represent different values in the new JSON.
    let value: valueof<T>;
    if (
      isReference<valueof<valueof<T>>>() &&
      arbitraryInner &&
      load<u16>(srcStart) == BRACKET_LEFT
    ) {
      const inner = instantiate<JSON.Value[]>();
      srcStart = parseArrayBody(inner, srcStart + 2, srcEnd);
      if (srcStart == 0) return changetype<T>(0);
      // @ts-ignore: valueof<T> is JSON.Value[] in this branch
      value = changetype<valueof<T>>(changetype<usize>(inner));
    } else {
      // Skip complete JSON values, including quoted brackets and escaped
      // quotes/backslashes, instead of counting every '[' and ']' byte.
      const valueEnd = scanValueEnd(srcStart, srcEnd);
      if (!valueEnd || valueEnd <= srcStart) break;
      value = JSON.__deserialize<valueof<T>>(srcStart, valueEnd);
      srcStart = valueEnd;
    }

    if (index < out.length) {
      unchecked((out[index] = value));
    } else {
      out.push(value);
    }
    index++;

    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    const code = load<u16>(srcStart);
    if (code == COMMA) {
      srcStart += 2;
      continue;
    }
    if (code == BRACKET_RIGHT && srcStart + 2 == srcEnd) {
      out.length = index;
      return out;
    }
    break;
  }

  throw new Error("Failed to parse JSON!");
}
