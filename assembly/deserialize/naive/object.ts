import { JSON } from "../..";
import {
  COMMA,
  CHAR_F,
  BRACE_LEFT,
  BRACKET_LEFT,
  CHAR_N,
  QUOTE,
  BRACE_RIGHT,
  BRACKET_RIGHT,
  CHAR_T,
  COLON,
} from "../../custom/chars";
import { isSpace, scanStringEnd } from "../../util";
import { deserializeFloat } from "../index/float";
import { deserializeString } from "../index/string";

// "true"  as a u64 of UTF-16 code units (LE).
// @ts-ignore: inline
@inline const TRUE_WORD: u64 = 28429475166421108;
// "alse"  — the tail of "false", read at +2 so the leading 'f' is skipped.
// @ts-ignore: inline
@inline const ALSE_WORD: u64 = 28429466576093281;
// "null"  as a u64 of UTF-16 code units (LE).
// @ts-ignore: inline
@inline const NULL_WORD: u64 = 30399761348886638;

// End offset (just past the value) of the most recent parseValue() call. The
// recursive-descent parser reports each value's end through this single cursor
// so containers can resume after a child without a separate bounds scan. It is
// only read immediately after parseValue() returns, before any other
// parseValue() runs, so recursion never clobbers a still-needed value.
let parseValueEnd: usize = 0;

export function deserializeObject(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): JSON.Obj {
  const out = changetype<JSON.Obj>(dst || changetype<usize>(new JSON.Obj()));

  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  if (srcEnd == srcStart)
    throw new Error("Input string had zero length or was all whitespace");
  if (load<u16>(srcStart) != BRACE_LEFT)
    throw new Error(
      "Expected '{' at start of object at position " +
        (srcEnd - srcStart).toString(),
    );
  if (load<u16>(srcEnd - 2) != BRACE_RIGHT)
    throw new Error(
      "Expected '}' at end of object at position " +
        (srcEnd - srcStart).toString(),
    );

  parseObjectBody(out, srcStart + 2, srcEnd);
  return out;
}

/**
 * Parses a single JSON value whose first character is at `srcStart` (`srcEnd`
 * is an upper bound). Returns the value and sets {@link parseValueEnd} to the
 * offset just after it. Nested objects and arrays recurse here, so every byte
 * is scanned exactly once.
 */
/** Offset just past the value returned by the most recent {@link parseValue}. */
export function lastValueEnd(): usize {
  return parseValueEnd;
}

export function parseValue(srcStart: usize, srcEnd: usize): JSON.Value {
  const code = load<u16>(srcStart);
  if (code == QUOTE) {
    const end = scanStringEnd(srcStart, srcEnd);
    if (end >= srcEnd) throw new Error("Unterminated string in JSON");
    parseValueEnd = end + 2;
    return JSON.Value.from(deserializeString(srcStart, end + 2));
  } else if (code == BRACE_LEFT) {
    const obj = new JSON.Obj();
    parseValueEnd = parseObjectBody(obj, srcStart + 2, srcEnd);
    return JSON.Value.from(obj);
  } else if (code == BRACKET_LEFT) {
    const arr = instantiate<JSON.Value[]>();
    parseValueEnd = parseArrayBody(arr, srcStart + 2, srcEnd);
    return JSON.Value.from(arr);
  } else if (code - 48 <= 9 || code == 45) {
    let p = srcStart + 2;
    while (p < srcEnd) {
      const c = load<u16>(p);
      if (c == COMMA || c == BRACKET_RIGHT || c == BRACE_RIGHT || isSpace(c))
        break;
      p += 2;
    }
    parseValueEnd = p;
    return JSON.Value.from(deserializeFloat<f64>(srcStart, p));
  } else if (code == CHAR_T) {
    if (load<u64>(srcStart) != TRUE_WORD)
      throw new Error("Expected 'true' in JSON");
    parseValueEnd = srcStart + 8;
    return JSON.Value.from(true);
  } else if (code == CHAR_F) {
    if (load<u64>(srcStart, 2) != ALSE_WORD)
      throw new Error("Expected 'false' in JSON");
    parseValueEnd = srcStart + 10;
    return JSON.Value.from(false);
  } else if (code == CHAR_N) {
    if (load<u64>(srcStart) != NULL_WORD)
      throw new Error("Expected 'null' in JSON");
    parseValueEnd = srcStart + 8;
    return JSON.Value.from<usize>(0);
  }
  throw new Error(
    "Unexpected character in JSON '" + String.fromCharCode(code) + "'",
  );
}

/**
 * Parses array elements starting at `srcStart` (just past the opening `[`)
 * until the matching `]`, returning the offset just after that `]`. Nested
 * values are parsed in the same pass.
 */
export function parseArrayBody(
  out: JSON.Value[],
  srcStart: usize,
  srcEnd: usize,
): usize {
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (isSpace(code) || code == COMMA) {
      srcStart += 2;
      continue;
    }
    if (code == BRACKET_RIGHT) return srcStart + 2;
    out.push(parseValue(srcStart, srcEnd));
    srcStart = parseValueEnd;
  }
  return srcEnd;
}

/**
 * Parses object members starting at `srcStart` (just past the opening `{`)
 * until the matching `}`, returning the offset just after that `}`. `srcEnd`
 * is an upper bound (end of the enclosing buffer), not the object's exact end.
 */
export function parseObjectBody(
  out: JSON.Obj,
  srcStart: usize,
  srcEnd: usize,
): usize {
  while (srcStart < srcEnd) {
    let code = load<u16>(srcStart);

    // Skip insignificant whitespace and member separators before each key.
    if (isSpace(code) || code == COMMA) {
      srcStart += 2;
      continue;
    }
    if (code == BRACE_RIGHT) return srcStart + 2;

    // --- key ---
    if (code != QUOTE)
      throw new Error(
        "Unexpected character in JSON object '" +
          String.fromCharCode(code) +
          "' at position " +
          (srcEnd - srcStart).toString(),
      );
    const keyStart = srcStart + 2;
    srcStart = scanStringEnd(srcStart, srcEnd);
    if (srcStart >= srcEnd)
      throw new Error("Unterminated string in JSON object");
    const keyEnd = srcStart;
    srcStart += 2;

    // --- colon ---
    while (srcStart < srcEnd && isSpace((code = load<u16>(srcStart))))
      srcStart += 2;
    if (srcStart >= srcEnd || code != COLON)
      throw new Error(
        "Expected ':' after key at position " + (srcEnd - srcStart).toString(),
      );
    srcStart += 2;

    // --- value ---
    while (srcStart < srcEnd && isSpace((code = load<u16>(srcStart))))
      srcStart += 2;
    out.appendRaw(keyStart, keyEnd, parseValue(srcStart, srcEnd));
    srcStart = parseValueEnd;
  }
  return srcEnd;
}
