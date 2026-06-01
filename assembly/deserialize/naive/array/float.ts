import { isSpace } from "../../../util";
import { COMMA, BRACKET_LEFT, BRACKET_RIGHT } from "../../../custom/chars";
import { JSON } from "../../..";

/**
 * Strict float-array deserializer (`f64[]` / `f32[]`).
 *
 * Enforces RFC 8259 array structure: `[`-framed, single-comma separated, no
 * leading / trailing / doubled commas, and no garbage between values. Each
 * element token is validated by `deserializeFloat_NAIVE` (via `JSON.__deserialize`),
 * so malformed numbers like `0e` / `-01` / `1.` are rejected here too. Throws on
 * any deviation.
 */
export function deserializeFloatArray_NAIVE<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );
  // `dst` may arrive pre-sized (e.g. the SWAR fast path presizes then falls
  // back here); we re-parse from scratch via push, so start from empty.
  out.length = 0;

  // Trim surrounding whitespace and require the enclosing brackets.
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
  if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT)
    throw new Error("Invalid JSON array: expected '['");
  if (load<u16>(srcEnd - 2) != BRACKET_RIGHT)
    throw new Error("Invalid JSON array: expected ']'");
  srcStart += 2; // past '['
  srcEnd -= 2; // before ']'

  // skip whitespace; an empty body is a valid empty array
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  if (srcStart >= srcEnd) return out;

  while (true) {
    // value token: runs until whitespace or a comma
    const tokenStart = srcStart;
    while (srcStart < srcEnd) {
      const c = load<u16>(srcStart);
      if (c == COMMA || isSpace(c)) break;
      srcStart += 2;
    }
    if (srcStart == tokenStart)
      throw new Error("Invalid JSON array: missing value");
    out.push(JSON.__deserialize<valueof<T>>(tokenStart, srcStart));

    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break; // end of array body
    if (load<u16>(srcStart) != COMMA)
      throw new Error("Invalid JSON array: expected ',' or ']'");
    srcStart += 2; // past ','
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd)
      throw new Error("Invalid JSON array: trailing comma");
  }

  return out;
}
