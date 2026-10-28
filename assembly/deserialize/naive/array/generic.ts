import { JSON } from "../../..";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { isSpace } from "../../../util";
import { scanValueEnd } from "../../../util/scanValueEnd";

export function deserializeGenericArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );
  out.length = 0;

  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  if (srcStart >= srcEnd)
    throw new Error("Input string had zero length or was all whitespace");
  if (
    load<u16>(srcStart) != BRACKET_LEFT ||
    load<u16>(srcEnd - 2) != BRACKET_RIGHT
  )
    throw new Error("Expected array brackets");
  srcStart += 2;

  while (srcStart < srcEnd) {
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;

    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      if (srcStart + 2 != srcEnd) break;
      return out;
    }

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
    if (code == BRACKET_RIGHT) {
      if (srcStart + 2 != srcEnd) break;
      return out;
    }
    break;
  }

  throw new Error("Failed to parse JSON!");
}

export function deserializeCustomArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const valueEnd = scanValueEnd(srcStart, srcEnd);
  if (!valueEnd) throw new Error("Failed to parse JSON!");
  let end = valueEnd;
  while (end < srcEnd && isSpace(load<u16>(end))) end += 2;
  if (end != srcEnd) throw new Error("Failed to parse JSON!");
  return deserializeGenericArray<T>(srcStart, valueEnd, dst);
}

// Custom array fields cannot use the generated struct-element fast path:
// their wire values need not be objects, and their hooks return replacements.
export function deserializeCustomArrayField<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  const valueEnd = scanValueEnd(srcStart, srcEnd);
  if (!valueEnd) throw new Error("Failed to parse JSON!");
  store<T>(
    fieldPtr,
    deserializeGenericArray<T>(srcStart, valueEnd, load<usize>(fieldPtr)),
  );
  return valueEnd;
}
