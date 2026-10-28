import { JSON } from "../..";
import { deserializeBooleanCode } from "./bool";
import { deserializeFloat } from "./float";
import { deserializeObject, deserializeJsonArray, getParseSrc } from "./object";
import { deserializeString } from "./string";
import { BRACE_LEFT, BRACKET_LEFT, CHAR_N, QUOTE } from "../../custom/chars";
import {
  validateJSONNumberToken,
  validateJSONNumberTokenLoose,
} from "../../util/validateJson";

const NULL_WORD: u64 = 30399761348886638;

export function deserializeArbitrary(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): JSON.Value {
  const v = parseArbitraryValue(srcStart, srcEnd);
  if (changetype<usize>(v) == 0) return v;
  // Reuse path (`JSON.parse<JSON.Value>(data, out)`): write the parsed bits into
  // the caller's handle (with the GC barrier for any managed payload).
  return dst != 0 ? JSON.Value.__adoptInto(dst, v) : v;
}

function parseArbitraryValue(srcStart: usize, srcEnd: usize): JSON.Value {
  if (srcStart >= srcEnd) return changetype<JSON.Value>(0);
  const firstChar = load<u16>(srcStart);
  if (
    firstChar == QUOTE ||
    firstChar == BRACE_LEFT ||
    firstChar == BRACKET_LEFT
  ) {
    const valueEnd = JSON.Util.scanValueEnd<JSON.Value>(srcStart, srcEnd);
    // Apply exact-root framing to both public anchored parses and direct
    // bounded __deserialize calls. Only insignificant suffix whitespace may
    // remain outside the decoded value.
    if (valueEnd == 0 || JSON.Util.skipWhitespace(valueEnd, srcEnd) != srcEnd)
      return changetype<JSON.Value>(0);

    // Lazy by default: when a parse is in flight (source anchor present), defer
    // strings and composites (the allocating shapes) - store the exact raw slice
    // and materialize on first access. Cheap primitives stay eager below.
    const src = getParseSrc();
    if (src.length != 0) {
      return JSON.Value.fromSlice(srcStart, valueEnd, src);
    }
    if (firstChar == QUOTE) {
      const value = deserializeString(srcStart, valueEnd);
      return changetype<usize>(value) != 0
        ? JSON.Value.from(value)
        : changetype<JSON.Value>(0);
    }
    const composite =
      firstChar == BRACE_LEFT
        ? changetype<usize>(deserializeObject(srcStart, valueEnd, 0))
        : changetype<usize>(deserializeJsonArray(srcStart, valueEnd, 0));
    return composite != 0
      ? firstChar == BRACE_LEFT
        ? JSON.Value.from(changetype<JSON.Obj>(composite))
        : JSON.Value.from(changetype<JSON.Arr>(composite))
      : changetype<JSON.Value>(0);
  } else if (
    firstChar - 48 <= 9 ||
    firstChar == 45 ||
    firstChar == 78 ||
    firstChar == 73 ||
    firstChar == 105 ||
    (firstChar == 110 &&
      srcStart + 2 < srcEnd &&
      (load<u16>(srcStart, 2) | 32) == 97)
  ) {
    let tokenEnd = srcEnd;
    while (tokenEnd > srcStart && JSON.Util.isSpace(load<u16>(tokenEnd - 2)))
      tokenEnd -= 2;
    return (
      JSON_STRICT
        ? validateJSONNumberToken(srcStart, tokenEnd)
        : validateJSONNumberTokenLoose(srcStart, tokenEnd)
    )
      ? JSON.Value.from(deserializeFloat<f64>(srcStart, tokenEnd))
      : changetype<JSON.Value>(0);
  } else if (firstChar == 116 || firstChar == 102) {
    const code = deserializeBooleanCode(srcStart, srcEnd);
    return code != 0 ? JSON.Value.from(code == 2) : changetype<JSON.Value>(0);
  } else if (firstChar == CHAR_N) {
    if (
      srcEnd - srcStart < 8 ||
      load<u64>(srcStart) != NULL_WORD ||
      JSON.Util.skipWhitespace(srcStart + 8, srcEnd) != srcEnd
    )
      return changetype<JSON.Value>(0);
    return JSON.Value.from<usize>(0);
  }
  return changetype<JSON.Value>(0);
}
