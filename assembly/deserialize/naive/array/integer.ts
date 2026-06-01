import { atoi, isSpace } from "../../../util";
import { COMMA, BRACKET_LEFT, BRACKET_RIGHT } from "../../../custom/chars";

// Strict RFC 8259 integer-token check over [start, end): optional minus (signed
// types only), then a lone `0` or [1-9] digits — no leading zeros, fraction,
// exponent, or trailing garbage. Throws otherwise.
// @ts-ignore: inline
@inline function validateJSONInteger(
  start: usize,
  end: usize,
  signed: bool,
): void {
  let ptr = start;
  if (ptr < end && load<u16>(ptr) == 45) {
    if (!signed) throw new Error("Invalid JSON number: minus on unsigned");
    ptr += 2;
  }
  if (ptr >= end) throw new Error("Invalid JSON number: expected digit");
  const first = load<u16>(ptr);
  if (first == 48) {
    ptr += 2;
    if (ptr < end && <u32>(load<u16>(ptr) - 48) <= 9)
      throw new Error("Invalid JSON number: leading zero");
  } else if (<u32>(first - 48) <= 9) {
    ptr += 2;
    while (ptr < end && <u32>(load<u16>(ptr) - 48) <= 9) ptr += 2;
  } else {
    throw new Error("Invalid JSON number: expected digit");
  }
  if (ptr != end) throw new Error("Invalid JSON number: not an integer");
}

/**
 * Strict integer-array deserializer (`i8[]`..`i64[]`, `u8[]`..`u64[]`).
 *
 * Enforces RFC 8259 array structure: `[`-framed, single-comma separated, no
 * leading / trailing / doubled commas, and each element must be a valid JSON
 * integer (no leading zeros, fraction, or exponent). Throws on any deviation.
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

  const signed = isSigned<valueof<T>>();
  while (true) {
    const tokenStart = srcStart;
    while (srcStart < srcEnd) {
      const c = load<u16>(srcStart);
      if (c == COMMA || isSpace(c)) break;
      srcStart += 2;
    }
    if (srcStart == tokenStart)
      throw new Error("Invalid JSON array: missing value");
    validateJSONInteger(tokenStart, srcStart, signed);
    out.push(atoi<valueof<T>>(tokenStart, srcStart));

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
