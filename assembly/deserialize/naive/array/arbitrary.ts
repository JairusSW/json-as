import { JSON } from "../../../";
import { parseArrayBody } from "../object";

export function deserializeArbitraryArray(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): JSON.Value[] {
  const out = changetype<JSON.Value[]>(
    dst || changetype<usize>(instantiate<JSON.Value[]>()),
  );
  // Skip the opening '[' and parse elements single-pass until the matching ']'.
  parseArrayBody(out, srcStart + 2, srcEnd);
  return out;
}
