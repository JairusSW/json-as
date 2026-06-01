import { isSpace } from "../../../util";
import {
  COMMA,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  FALSE_WORD_U64,
  TRUE_WORD_U64,
} from "../../../custom/chars";

/**
 * Strict boolean-array deserializer (`bool[]`, every JSON_MODE).
 *
 * Enforces RFC 8259 array structure: `[`-framed, single-comma separated, no
 * leading / trailing / doubled commas, and each element must be exactly the
 * literal `true` or `false`. Throws on any deviation.
 *
 * The token check is SWAR-shaped: one `u64` load matches all four chars of
 * `true`; `false` adds one `u16` load to confirm the trailing `e`.
 */
export function deserializeBooleanArray<T extends boolean[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
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
    if (srcStart + 8 <= srcEnd && load<u64>(srcStart) == TRUE_WORD_U64) {
      out.push(true);
      srcStart += 8;
    } else if (
      srcStart + 10 <= srcEnd &&
      load<u64>(srcStart) == FALSE_WORD_U64 &&
      load<u16>(srcStart, 8) == 101
    ) {
      out.push(false);
      srcStart += 10;
    } else {
      throw new Error("Invalid JSON array: expected 'true' or 'false'");
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
