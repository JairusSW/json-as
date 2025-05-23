import { JSON } from "../..";
import { deserializeArray } from "./array";
import { deserializeBoolean } from "./bool";
import { deserializeFloat } from "./float";
import { deserializeString } from "./string";
import { deserializeObject } from "./object";
import { BRACE_LEFT, BRACKET_LEFT, CHAR_N, QUOTE } from "../../custom/chars";

export function deserializeArbitrary(srcStart: usize, srcEnd: usize, dst: usize): JSON.Value {
  const firstChar = load<u16>(srcStart);
  if (firstChar == QUOTE) return JSON.Value.from(deserializeString(srcStart, srcEnd, 0));
  else if (firstChar == BRACE_LEFT) return JSON.Value.from(deserializeObject(srcStart, srcEnd, 0));
  else if (firstChar - 48 <= 9 || firstChar == 45) return JSON.Value.from(deserializeFloat<f64>(srcStart, srcEnd));
  else if (firstChar == BRACKET_LEFT) {
    return JSON.Value.from(deserializeArray<JSON.Value[]>(srcStart, srcEnd, 0));
  } else if (firstChar == 116 || firstChar == 102) return JSON.Value.from(deserializeBoolean(srcStart, srcEnd));
  else if (firstChar == CHAR_N) {
    return JSON.Value.from<usize>(0);
  }
  return unreachable();
}
