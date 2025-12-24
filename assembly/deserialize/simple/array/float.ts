import { isSpace } from "../../../util";
import { COMMA, BRACKET_RIGHT } from "../../../custom/chars";
import { JSON } from "../../..";

export function deserializeFloatArray<T extends number[]>(srcStart: usize, srcEnd: usize, dst: usize): T {
  const out = changetype<nonnull<T>>(dst || changetype<usize>(instantiate<T>()));
  let lastIndex: usize = 0;
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code - 48 <= 9 || code == 45) {
      lastIndex = srcStart;
      srcStart += 2;
      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (code == COMMA || code == BRACKET_RIGHT || isSpace(code)) {
          out.push(JSON.__deserialize<valueof<T>>(lastIndex, srcStart));
          // while (isSpace(load<u16>((srcStart += 2)))) {
          //   /* empty */
          // }
          break;
        }
        srcStart += 2;
      }
    }
    srcStart += 2;
  }
  return out;
}
