import { JSON } from "../..";
import { deserializeBoolean } from "./bool";
import { deserializeFloat } from "./float";
import { deserializeObject, deserializeJsonArray, getParseSrc } from "./object";
import { deserializeString } from "./string";
import { BRACE_LEFT, BRACKET_LEFT, CHAR_N, QUOTE } from "../../custom/chars";

export function deserializeArbitrary(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): JSON.Value {
  const v = parseArbitraryValue(srcStart, srcEnd);
  // Reuse path (`JSON.parse<JSON.Value>(data, out)`): write the parsed bits into
  // the caller's handle (with the GC barrier for any managed payload).
  return dst != 0 ? JSON.Value.__adoptInto(dst, v) : v;
}

function parseArbitraryValue(srcStart: usize, srcEnd: usize): JSON.Value {
  const firstChar = load<u16>(srcStart);
  if (
    firstChar == QUOTE ||
    firstChar == BRACE_LEFT ||
    firstChar == BRACKET_LEFT
  ) {
    // Lazy by default: when a parse is in flight (source anchor present), defer
    // strings and composites (the allocating shapes) - store the exact raw slice
    // and materialize on first access. Cheap primitives stay eager below.
    const src = getParseSrc();
    if (src.length != 0) {
      const end = JSON.Util.scanValueEnd<JSON.Value>(srcStart, srcEnd);
      return JSON.Value.fromSlice(srcStart, end, src);
    }
    if (firstChar == QUOTE)
      return JSON.Value.from(deserializeString(srcStart, srcEnd));
    return firstChar == BRACE_LEFT
      ? JSON.Value.from(deserializeObject(srcStart, srcEnd, 0))
      : JSON.Value.from(deserializeJsonArray(srcStart, srcEnd, 0));
  } else if (firstChar - 48 <= 9 || firstChar == 45) {
    return JSON.Value.from(deserializeFloat<f64>(srcStart, srcEnd));
  } else if (firstChar == 116 || firstChar == 102) {
    return JSON.Value.from(deserializeBoolean(srcStart, srcEnd));
  } else if (firstChar == CHAR_N) {
    return JSON.Value.from<usize>(0);
  }
  return unreachable();
}
