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
import { ptrToStr } from "../../util/ptrToStr";
import { deserializeArray } from "../index/array";
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

/**
 * Scans past a balanced `{...}` or `[...]` container and returns the offset
 * just after its closing delimiter. Strings are skipped wholesale so that
 * delimiters appearing inside them are not counted. Only the requested
 * delimiter pair is tracked for depth — JSON is balanced, so the matching
 * close is reached without inspecting the other bracket type.
 */
// @ts-ignore: inline
@inline function scanContainerEnd(
  ptr: usize,
  srcEnd: usize,
  open: u32,
  close: u32,
): usize {
  let depth = 1;
  ptr += 2;
  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (code == QUOTE) {
      ptr = scanStringEnd(ptr, srcEnd);
      if (ptr >= srcEnd) throw new Error("Unterminated string in JSON object");
    } else if (code == close) {
      if (--depth == 0) return ptr + 2;
    } else if (code == open) {
      depth++;
    }
    ptr += 2;
  }
  return srcEnd;
}

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

  srcStart += 2;
  while (srcStart < srcEnd) {
    let code = load<u16>(srcStart);

    // Skip insignificant whitespace and member separators before each key.
    if (isSpace(code) || code == COMMA) {
      srcStart += 2;
      continue;
    }
    if (code == BRACE_RIGHT) break;

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
    const key = ptrToStr(keyStart, srcStart);
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

    if (code == QUOTE) {
      const valStart = srcStart;
      srcStart = scanStringEnd(srcStart, srcEnd);
      if (srcStart >= srcEnd)
        throw new Error("Unterminated string in JSON object");
      out.set(key, deserializeString(valStart, srcStart + 2));
      srcStart += 2;
    } else if (code - 48 <= 9 || code == 45) {
      const valStart = srcStart;
      srcStart += 2;
      while (srcStart < srcEnd) {
        code = load<u16>(srcStart);
        if (code == COMMA || code == BRACE_RIGHT || isSpace(code)) break;
        srcStart += 2;
      }
      out.set(key, deserializeFloat<f64>(valStart, srcStart));
    } else if (code == BRACE_LEFT) {
      const valStart = srcStart;
      srcStart = scanContainerEnd(srcStart, srcEnd, BRACE_LEFT, BRACE_RIGHT);
      out.set(key, deserializeObject(valStart, srcStart, 0));
    } else if (code == BRACKET_LEFT) {
      const valStart = srcStart;
      srcStart = scanContainerEnd(
        srcStart,
        srcEnd,
        BRACKET_LEFT,
        BRACKET_RIGHT,
      );
      out.set(key, deserializeArray<JSON.Value[]>(valStart, srcStart, 0));
    } else if (code == CHAR_T) {
      if (load<u64>(srcStart) != TRUE_WORD)
        throw new Error("Expected 'true' in JSON object");
      out.set(key, true);
      srcStart += 8;
    } else if (code == CHAR_F) {
      if (load<u64>(srcStart, 2) != ALSE_WORD)
        throw new Error("Expected 'false' in JSON object");
      out.set(key, false);
      srcStart += 10;
    } else if (code == CHAR_N) {
      if (load<u64>(srcStart) != NULL_WORD)
        throw new Error("Expected 'null' in JSON object");
      out.set(key, JSON.Value.from<usize>(0));
      srcStart += 8;
    } else {
      throw new Error(
        "Unexpected character in JSON object '" +
          String.fromCharCode(code) +
          "' at position " +
          (srcEnd - srcStart).toString(),
      );
    }
  }
  return out;
}
