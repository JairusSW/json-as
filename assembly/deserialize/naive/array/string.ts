import { JSON } from "../../..";
import {
  COMMA,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  NULL_WORD_U64,
  QUOTE,
} from "../../../custom/chars";
import { isSpace, scanStringEnd } from "../../../util";

/**
 * Strict string-array deserializer (`string[]` / `(string | null)[]`).
 *
 * Enforces RFC 8259 array structure: `[`-framed, single-comma separated, no
 * leading / trailing / doubled commas, and each element must be a quoted string
 * (or the literal `null` for a nullable element type). Element contents are
 * validated by `deserializeString_NAIVE` (via `JSON.__deserialize`). Throws on
 * any deviation.
 */
export function deserializeStringArray_NAIVE(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): string[] {
  const out = changetype<string[]>(
    dst || changetype<usize>(instantiate<string[]>()),
  );
  out.length = 0; // dst may arrive pre-sized; re-parse from empty via push

  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
  if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT)
    throw new Error("Invalid JSON array: expected '['");
  if (load<u16>(srcEnd - 2) != BRACKET_RIGHT)
    throw new Error("Invalid JSON array: expected ']'");
  srcStart += 2; // past '['
  srcEnd -= 2; // before ']'

  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  if (srcStart >= srcEnd) return out;

  while (true) {
    const code = load<u16>(srcStart);
    if (code == QUOTE) {
      const closing = scanStringEnd(srcStart, srcEnd);
      if (closing >= srcEnd)
        throw new Error("Invalid JSON array: unterminated string");
      out.push(JSON.__deserialize<string>(srcStart, closing + 2));
      srcStart = closing + 2;
    } else if (srcStart + 8 <= srcEnd && load<u64>(srcStart) == NULL_WORD_U64) {
      // `(string | null)[]` element
      out.push(changetype<string>(0));
      srcStart += 8;
    } else {
      throw new Error("Invalid JSON array: expected string");
    }

    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) != COMMA)
      throw new Error("Invalid JSON array: expected ',' or ']'");
    srcStart += 2;
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd)
      throw new Error("Invalid JSON array: trailing comma");
  }

  return out;
}
