import { JSON } from "../../..";
import { NULL_WORD_U64, QUOTE } from "../../../custom/chars";
import { isUnescapedQuote } from "../../../util";

export function deserializeStringArray_NAIVE(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): string[] {
  const out = changetype<string[]>(
    dst || changetype<usize>(instantiate<string[]>()),
  );
  let lastPos: usize = 2;
  let inString = false;
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code == QUOTE) {
      if (!inString) {
        inString = true;
        lastPos = srcStart;
      } else if (isUnescapedQuote(srcStart)) {
        out.push(JSON.__deserialize<string>(lastPos, srcStart + 2));
        inString = false;
      }
      srcStart += 2;
    } else if (
      !inString &&
      srcStart + 8 <= srcEnd &&
      load<u64>(srcStart) == NULL_WORD_U64
    ) {
      // `(string | null)[]` element: push the null reference and skip
      // past the 4-char `null` token. Outside strings only — quoted
      // content might legitimately contain the substring "null".
      out.push(changetype<string>(0));
      srcStart += 8;
    } else {
      srcStart += 2;
    }
  }
  return out;
}
