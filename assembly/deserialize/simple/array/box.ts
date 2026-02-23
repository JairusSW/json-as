import { isSpace } from "../../../util";
import { COMMA, BRACKET_RIGHT } from "../../../custom/chars";
import { JSON } from "../../..";

export function deserializeBoxArray<T extends JSON.Box<any>[]>(srcStart: usize, srcEnd: usize, dst: usize): T {
  const out = changetype<nonnull<T>>(dst || changetype<usize>(instantiate<T>()));
  if (isBoolean<valueof<T>>()) {
    srcStart += 2; // skip [
    while (srcStart < srcEnd) {
      const block = load<u64>(srcStart);
      if (block == 28429475166421108) {
        out.push(JSON.Box.from(true));
        srcStart += 10;
      } else if (block == 32370086184550502 && load<u16>(srcStart, 8) == 101) {
        out.push(JSON.Box.from(false));
        srcStart += 12;
      } else {
        srcStart += 2;
      }
    }
    return out;
  } else {
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
  }
  return out;
}
