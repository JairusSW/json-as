import {
  BACK_SLASH,
  BRACE_LEFT,
  BRACE_RIGHT,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  CHAR_F,
  CHAR_N,
  CHAR_T,
  COMMA,
  QUOTE,
} from "../../../custom/chars";
import { JSON } from "../../../";
import { isSpace } from "util/string";
import { ptrToStr } from "../../../util/ptrToStr";

export function deserializeArbitraryArray(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): JSON.Value[] {
  const out = changetype<JSON.Value[]>(
    dst || changetype<usize>(instantiate<JSON.Value[]>()),
  );
  let lastIndex: usize = 0;
  let depth: u32 = 0;
  // if (load<u16>(srcStart) != BRACKET_LEFT)
  srcStart += 2;
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    // console.log("code: " + String.fromCharCode(code));
    if (code == BRACE_LEFT) {
      lastIndex = srcStart;
      depth++;
      srcStart += 2;
      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (code == BRACE_RIGHT) {
          if (--depth == 0) {
            // @ts-ignore: type
            out.push(JSON.__deserialize<JSON.Value>(lastIndex, srcStart + 2));
            // console.log("Value (object): " + ptrToStr(lastIndex, srcStart + 2));
            break;
          }
        } else if (code == BRACE_LEFT) depth++;
        srcStart += 2;
      }
    } else if (code == QUOTE) {
      lastIndex = srcStart;
      srcStart += 2;
      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (code == QUOTE && load<u16>(srcStart - 2) !== BACK_SLASH) {
          // while (isSpace(load<u16>((srcStart += 2)))) {
          //   /* empty */
          // }
          // console.log("Value (string): " + ptrToStr(lastIndex, srcStart + 2));
          // @ts-ignore: exists
          out.push(JSON.__deserialize<JSON.Value>(lastIndex, srcStart + 2));
          srcStart += 2;
          break;
        }
        srcStart += 2;
      }
      // console.log("next: " + String.fromCharCode(load<u16>(srcStart)));
    } else if (code - 48 <= 9 || code == 45) {
      // console.log("trigger int")
      lastIndex = srcStart;
      srcStart += 2;
      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (code == COMMA || code == BRACKET_RIGHT || isSpace(code)) {
          // @ts-ignore: type
          out.push(JSON.__deserialize<JSON.Value>(lastIndex, srcStart));
          // console.log("Value (number): " + ptrToStr(lastIndex, srcStart));
          break;
        }
        srcStart += 2;
      }
      // console.log("next: " + String.fromCharCode(load<u16>(srcStart)));
    } else if (code == BRACE_LEFT) {
      lastIndex = srcStart;
      depth++;
      srcStart += 2;
      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (code == BRACE_RIGHT) {
          if (--depth == 0) {
            // @ts-ignore: type
            out.push(JSON.__deserialize<JSON.Value>(lastIndex, srcStart));
            // console.log("Value (object): " + ptrToStr(lastIndex, srcStart));
            while (isSpace(load<u16>((srcStart += 2)))) {
              /* empty */
            }
            break;
          }
        } else if (code == BRACE_LEFT) depth++;
        srcStart += 2;
      }
    } else if (code == BRACKET_LEFT) {
      lastIndex = srcStart;
      depth++;
      srcStart += 2;
      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (code == BRACKET_RIGHT) {
          if (--depth == 0) {
            // @ts-ignore: type
            out.push(JSON.__deserialize<JSON.Value>(lastIndex, srcStart));
            // console.log("Value (array): " + ptrToStr(lastIndex, srcStart));
            while (isSpace(load<u16>((srcStart += 2)))) {
              /* empty */
            }
            break;
          }
        } else if (code == BRACKET_LEFT) depth++;
        srcStart += 2;
      }
    } else if (code == CHAR_T) {
      if (load<u64>(srcStart) == 28429475166421108) {
        // @ts-ignore: type
        out.push(JSON.__deserialize<JSON.Value>(srcStart, (srcStart += 8)));
        // console.log("Value (bool): " + ptrToStr(srcStart - 8, srcStart));
        // while (isSpace(load<u16>((srcStart += 2)))) {
        //   /* empty */
        // }
        // console.log("next: " + String.fromCharCode(load<u16>(srcStart)));
      }
    } else if (code == CHAR_F) {
      if (load<u64>(srcStart, 2) == 28429466576093281) {
        // @ts-ignore: type
        out.push(JSON.__deserialize<JSON.Value>(srcStart, (srcStart += 10)));
        // console.log("Value (bool): " + ptrToStr(srcStart - 10, srcStart));
        // while (isSpace(load<u16>((srcStart += 2)))) {
        //   /* empty */
        // }
        // console.log("next: " + String.fromCharCode(load<u16>(srcStart)));
      }
    } else if (code == CHAR_N) {
      if (load<u64>(srcStart) == 30399761348886638) {
        // console.log("Value (null): " + ptrToStr(srcStart, srcStart + 8));
        // @ts-ignore: type
        out.push(JSON.__deserialize<JSON.Value>(srcStart, (srcStart += 8)));
        // while (isSpace(load<u16>((srcStart += 2)))) {
        //   /* empty */
        // }
      }
    }
    srcStart += 2;
  }
  // @ts-ignore: type
  return out;
}
