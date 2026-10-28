import { atoi, isSpace } from "../../../util";
import { COMMA, BRACKET_LEFT, BRACKET_RIGHT } from "../../../custom/chars";
import { markProductionParseError } from "../../error";
import { validateJSONIntegerToken } from "../../../util/validateJson";

/**
 * Strict integer-array deserializer (`i8[]`..`i64[]`, `u8[]`..`u64[]`).
 *
 * Enforces RFC 8259 array structure: `[`-framed, single-comma separated, no
 * leading / trailing / doubled commas, and each element must be a valid JSON
 * integer (no leading zeros, fraction, or exponent). Returns the shared failure
 * sentinel on any deviation.
 */
export function deserializeIntegerArray_NAIVE<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );
  out.length = 0; // dst may arrive pre-sized; re-parse from empty via push

  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
  if (
    srcStart >= srcEnd ||
    load<u16>(srcStart) != BRACKET_LEFT ||
    load<u16>(srcEnd - 2) != BRACKET_RIGHT
  ) {
    markProductionParseError();
    return changetype<T>(0);
  }
  srcStart += 2; // past '['
  srcEnd -= 2; // before ']'

  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  if (srcStart >= srcEnd) return out;

  const signed = isSigned<valueof<T>>();
  while (true) {
    const tokenStart = srcStart;
    while (srcStart < srcEnd) {
      const c = load<u16>(srcStart);
      if (c == COMMA || isSpace(c)) break;
      srcStart += 2;
    }
    if (
      srcStart == tokenStart ||
      !validateJSONIntegerToken(tokenStart, srcStart, signed)
    ) {
      markProductionParseError();
      return changetype<T>(0);
    }
    out.push(atoi<valueof<T>>(tokenStart, srcStart));

    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) != COMMA) {
      markProductionParseError();
      return changetype<T>(0);
    }
    srcStart += 2;
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) {
      markProductionParseError();
      return changetype<T>(0);
    }
  }

  return out;
}
