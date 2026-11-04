import { JSON } from "../../../";
import { parseArrayBody } from "../object";

export function deserializeArbitraryArray<T extends JSON.Value[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<T>(dst || changetype<usize>(instantiate<T>()));
  out.length = 0;
  // Skip the opening '[' and parse elements single-pass until the matching ']'.
  return parseArrayBody(out, srcStart + 2, srcEnd) != 0
    ? out
    : changetype<T>(0);
}
