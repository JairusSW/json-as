import {
  COMMA,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  NULL_WORD_U64,
  QUOTE,
} from "../../../custom/chars";
import { isSpace, scanStringEnd } from "../../../util";
import { markProductionParseError } from "../../error";
import { deserializeString } from "../../index/string";

/**
 * Strict string-array deserializer (`string[]` / `(string | null)[]`).
 *
 * Enforces RFC 8259 array structure: `[`-framed, single-comma separated, no
 * leading / trailing / doubled commas, and each element must be a quoted string
 * (or the literal `null` for a nullable element type). Element contents are
 * validated by the selected whole-string decoder. Returns the shared failure
 * sentinel on any deviation so JSON.parse can throw at its public boundary.
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

  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
  if (
    srcStart >= srcEnd ||
    load<u16>(srcStart) != BRACKET_LEFT ||
    load<u16>(srcEnd - 2) != BRACKET_RIGHT
  ) {
    markProductionParseError();
    return changetype<string[]>(0);
  }
  srcStart += 2; // past '['
  srcEnd -= 2; // before ']'

  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  if (srcStart >= srcEnd) return out;

  while (true) {
    const code = load<u16>(srcStart);
    if (code == QUOTE) {
      const closing = scanStringEnd(srcStart, srcEnd);
      if (closing >= srcEnd) {
        markProductionParseError();
        return changetype<string[]>(0);
      }
      const value = deserializeString(srcStart, closing + 2);
      if (changetype<usize>(value) == 0) return changetype<string[]>(0);
      out.push(value);
      srcStart = closing + 2;
    } else if (srcStart + 8 <= srcEnd && load<u64>(srcStart) == NULL_WORD_U64) {
      // `(string | null)[]` element
      out.push(changetype<string>(0));
      srcStart += 8;
    } else {
      markProductionParseError();
      return changetype<string[]>(0);
    }

    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) != COMMA) {
      markProductionParseError();
      return changetype<string[]>(0);
    }
    srcStart += 2;
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) {
      markProductionParseError();
      return changetype<string[]>(0);
    }
  }

  return out;
}
