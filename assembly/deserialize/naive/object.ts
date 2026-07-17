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
import {
  failProductionParse,
  markProductionParseError,
  takeProductionParseError,
} from "../error";

// "true"  as a u64 of UTF-16 code units (LE).
const TRUE_WORD: u64 = 28429475166421108;
// "alse"  - the tail of "false", read at +2 so the leading 'f' is skipped.
const ALSE_WORD: u64 = 28429466576093281;
// "null"  as a u64 of UTF-16 code units (LE).
const NULL_WORD: u64 = 30399761348886638;

// End offset (just past the value) of the most recent parseValue() call. The
// recursive-descent parser reports each value's end through this single cursor
// so containers can resume after a child without a separate bounds scan. It is
// only read immediately after parseValue() returns, before any other
// parseValue() runs, so recursion never clobbers a still-needed value.
let parseValueEnd: usize = 0;

// Source string for the parse currently in flight. When non-empty, nested
// objects/arrays are deferred: instead of being recursively materialized, each
// is stored as a lazy JSON.Value holding its raw slice + this anchor (see
// JSON.Value.fromSlice / JSON.Types.Lazy). Set at the top of JSON.parse (and in
// JSON.Value.materialize), both of which save/restore it for re-entrancy, so any
// lazy value built during a parse points into that parse's own source buffer.
let parseSrc: string = "";
export function setParseSrc(s: string): void {
  parseSrc = s;
}
export function getParseSrc(): string {
  return parseSrc;
}
export { markProductionParseError, takeProductionParseError };

export function deserializeObject(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): JSON.Obj {
  const reuse = dst != 0;
  const out = changetype<JSON.Obj>(
    reuse ? dst : changetype<usize>(new JSON.Obj()),
  );
  // Reuse path (`JSON.parse<JSON.Obj>(data, out)`): empty the handle first,
  // keeping its buffer capacity, so we overwrite rather than append stale data.
  if (reuse) out.clear();

  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  if (
    srcEnd == srcStart ||
    load<u16>(srcStart) != BRACE_LEFT ||
    load<u16>(srcEnd - 2) != BRACE_RIGHT
  ) {
    failProductionParse();
    return changetype<JSON.Obj>(0);
  }

  out.reserveForParse((srcEnd - srcStart) >> 1);
  return parseObjectBody(out, srcStart + 2, srcEnd) != 0
    ? out
    : changetype<JSON.Obj>(0);
}

export function deserializeJsonArray(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): JSON.Arr {
  const reuse = dst != 0;
  const out = changetype<JSON.Arr>(
    reuse ? dst : changetype<usize>(new JSON.Arr()),
  );
  if (reuse) out.clear();

  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  if (
    srcEnd == srcStart ||
    load<u16>(srcStart) != BRACKET_LEFT ||
    load<u16>(srcEnd - 2) != BRACKET_RIGHT
  ) {
    failProductionParse();
    return changetype<JSON.Arr>(0);
  }

  return parseArrayBodySlots(out, srcStart + 2, srcEnd) != 0
    ? out
    : changetype<JSON.Arr>(0);
}

/**
 * Parses array elements starting at `srcStart` (just past the opening `[`) into
 * a JSON.Arr's NaN-boxed value slots, returning the offset just after the
 * matching `]`. Mirrors {@link parseObjectBody} without keys.
 */
export function parseArrayBodySlots(
  out: JSON.Arr,
  srcStart: usize,
  srcEnd: usize,
): usize {
  out._src = parseSrc;
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (isSpace(code) || code == COMMA) {
      srcStart += 2;
      continue;
    }
    if (code == BRACKET_RIGHT) return srcStart + 2;
    if (parseSrc.length != 0) {
      out.pushRawSlot(parseSlotBits(srcStart, srcEnd));
    } else {
      const value = parseValue(srcStart, srcEnd);
      if (parseValueEnd == 0) return 0;
      out.pushRawSlot(JSON.Value.bitsFrom<JSON.Value>(value));
    }
    if (parseValueEnd == 0) return 0;
    srcStart = parseValueEnd;
  }
  return 0;
}

/**
 * Parses a single object-member value into a NaN-boxed value slot, setting
 * {@link parseValueEnd} to the offset just past it. Strings and composites are
 * deferred (a `valBox(Lazy, startPtr)` slice the object parses on first access);
 * numbers, booleans and null are parsed eagerly inline. Requires {@link parseSrc}
 * to be set (the caller guards), since a lazy slot points into it.
 */
function parseSlotBits(srcStart: usize, srcEnd: usize): u64 {
  if (srcStart >= srcEnd) {
    parseValueEnd = 0;
    markProductionParseError();
    return JSON.Value.nullBits();
  }
  const code = load<u16>(srcStart);
  if (code == QUOTE || code == BRACE_LEFT || code == BRACKET_LEFT) {
    const end = JSON.Util.scanValueEnd<JSON.Value>(srcStart, srcEnd);
    if (end == 0) {
      parseValueEnd = 0;
      markProductionParseError();
      return JSON.Value.nullBits();
    }
    parseValueEnd = end;
    return JSON.Value.lazyBits(changetype<usize>(parseSrc), srcStart, end);
  } else if (code - 48 <= 9 || code == 45) {
    let p = srcStart + 2;
    while (p < srcEnd) {
      const c = load<u16>(p);
      if (c == COMMA || c == BRACKET_RIGHT || c == BRACE_RIGHT || isSpace(c))
        break;
      p += 2;
    }
    parseValueEnd = p;
    return JSON.Value.f64Bits(deserializeFloat<f64>(srcStart, p));
  } else if (code == CHAR_T) {
    if (srcEnd - srcStart < 8 || load<u64>(srcStart) != TRUE_WORD) {
      parseValueEnd = 0;
      markProductionParseError();
      return JSON.Value.nullBits();
    }
    parseValueEnd = srcStart + 8;
    return JSON.Value.boolBits(true);
  } else if (code == CHAR_F) {
    if (srcEnd - srcStart < 10 || load<u64>(srcStart, 2) != ALSE_WORD) {
      parseValueEnd = 0;
      markProductionParseError();
      return JSON.Value.nullBits();
    }
    parseValueEnd = srcStart + 10;
    return JSON.Value.boolBits(false);
  } else if (code == CHAR_N) {
    if (srcEnd - srcStart < 8 || load<u64>(srcStart) != NULL_WORD) {
      parseValueEnd = 0;
      markProductionParseError();
      return JSON.Value.nullBits();
    }
    parseValueEnd = srcStart + 8;
    return JSON.Value.nullBits();
  }
  parseValueEnd = 0;
  markProductionParseError();
  return JSON.Value.nullBits();
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
  if (srcStart >= srcEnd) {
    parseValueEnd = 0;
    markProductionParseError();
    return changetype<JSON.Value>(0);
  }
  const code = load<u16>(srcStart);
  if (code == QUOTE) {
    const end = scanStringEnd(srcStart, srcEnd);
    if (end >= srcEnd) {
      parseValueEnd = 0;
      markProductionParseError();
      return changetype<JSON.Value>(0);
    }
    parseValueEnd = end + 2;
    const value = deserializeString(srcStart, end + 2);
    if (changetype<usize>(value) == 0) {
      parseValueEnd = 0;
      markProductionParseError();
      return changetype<JSON.Value>(0);
    }
    return JSON.Value.from(value);
  } else if (code == BRACE_LEFT) {
    const obj = new JSON.Obj();
    parseValueEnd = parseObjectBody(obj, srcStart + 2, srcEnd);
    return JSON.Value.from(obj);
  } else if (code == BRACKET_LEFT) {
    const arr = new JSON.Arr();
    parseValueEnd = parseArrayBodySlots(arr, srcStart + 2, srcEnd);
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
    if (srcEnd - srcStart < 8 || load<u64>(srcStart) != TRUE_WORD) {
      parseValueEnd = 0;
      markProductionParseError();
      return changetype<JSON.Value>(0);
    }
    parseValueEnd = srcStart + 8;
    return JSON.Value.from(true);
  } else if (code == CHAR_F) {
    if (srcEnd - srcStart < 10 || load<u64>(srcStart, 2) != ALSE_WORD) {
      parseValueEnd = 0;
      markProductionParseError();
      return changetype<JSON.Value>(0);
    }
    parseValueEnd = srcStart + 10;
    return JSON.Value.from(false);
  } else if (code == CHAR_N) {
    if (srcEnd - srcStart < 8 || load<u64>(srcStart) != NULL_WORD) {
      parseValueEnd = 0;
      markProductionParseError();
      return changetype<JSON.Value>(0);
    }
    parseValueEnd = srcStart + 8;
    return JSON.Value.from<usize>(0);
  }
  parseValueEnd = 0;
  markProductionParseError();
  return changetype<JSON.Value>(0);
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
    if (
      (code == BRACE_LEFT || code == BRACKET_LEFT || code == QUOTE) &&
      parseSrc.length != 0
    ) {
      // Defer strings and composites (the allocating shapes): store the raw
      // slice, parse on first access. Cheap primitives stay eager below.
      const end = JSON.Util.scanValueEnd<JSON.Value>(srcStart, srcEnd);
      if (end == 0) {
        markProductionParseError();
        return 0;
      }
      out.push(JSON.Value.fromSlice(srcStart, end, parseSrc));
      srcStart = end;
    } else {
      const value = parseValue(srcStart, srcEnd);
      if (parseValueEnd == 0) return 0;
      out.push(value);
      srcStart = parseValueEnd;
    }
  }
  return 0;
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
  const objectStart = srcStart - 2;
  // Anchor the source for this object's deferred value slots (start pointers
  // into it). Set here so every caller - deserializeObject, the JSON.Obj[]
  // array path, parseValue, the map path - gets it. Empty off the parse path,
  // where no lazy slots are produced.
  out._src = parseSrc;
  while (srcStart < srcEnd) {
    let code = load<u16>(srcStart);

    // Skip insignificant whitespace and member separators before each key.
    if (isSpace(code) || code == COMMA) {
      srcStart += 2;
      continue;
    }
    if (code == BRACE_RIGHT) {
      const objectEnd = srcStart + 2;
      out._rawStart = objectStart;
      out._rawEnd = objectEnd;
      return objectEnd;
    }

    // --- key ---
    if (code != QUOTE) return failProductionParse();
    const keyStart = srcStart + 2;
    srcStart = scanStringEnd(srcStart, srcEnd);
    if (srcStart >= srcEnd) return failProductionParse();
    const keyEnd = srcStart;
    srcStart += 2;

    // --- colon ---
    while (srcStart < srcEnd && isSpace((code = load<u16>(srcStart))))
      srcStart += 2;
    if (srcStart >= srcEnd || code != COLON) return failProductionParse();
    srcStart += 2;

    // --- value ---
    while (srcStart < srcEnd && isSpace((code = load<u16>(srcStart))))
      srcStart += 2;
    if (srcStart >= srcEnd) return failProductionParse();
    if (parseSrc.length != 0) {
      // Parsing: store a NaN-boxed slot directly (strings/composites deferred,
      // scalars eager) - no per-value JSON.Value object.
      out.appendParsedSlot(keyStart, keyEnd, parseSlotBits(srcStart, srcEnd));
      if (parseValueEnd == 0) return 0;
    } else {
      // Off the parse path (no source anchor): box eagerly.
      const value = parseValue(srcStart, srcEnd);
      if (parseValueEnd == 0) return 0;
      out.appendRaw(keyStart, keyEnd, value);
    }
    srcStart = parseValueEnd;
  }
  return 0;
}
