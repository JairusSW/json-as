import { isSpace } from "../../../util";
import { COMMA, BRACKET_RIGHT, QUOTE, BRACE_LEFT, BRACE_RIGHT, BRACKET_LEFT, BACK_SLASH, CHAR_T, CHAR_F, CHAR_N } from "../../../custom/chars";
import { JSON } from "../../..";
import { ptrToStr } from "../../../util/ptrToStr";

export function deserializeRawArray(srcStart: usize, srcEnd: usize, dst: usize): JSON.Raw[] {
  // console.log("data: " + ptrToStr(srcStart, srcEnd));
  const out = changetype<JSON.Raw[]>(dst || changetype<usize>(instantiate<JSON.Raw[]>()));
  let lastIndex: usize = 0;
  let depth = 0;
  srcStart += 2;
  while (srcStart < srcEnd) {
    let code = load<u16>(srcStart);
    if (code == QUOTE) {
      lastIndex = srcStart;
      srcStart += 2;
      while (srcStart < srcEnd) {
        code = load<u16>(srcStart);
        if (code == QUOTE || isSpace(code)) {
          // console.log("Value (string): " + ptrToStr(lastIndex, srcStart));
          out.push(JSON.Raw.from(ptrToStr(lastIndex, srcStart + 2)));
          // while (isSpace(load<u16>((srcStart += 2)))) {
          //   /* empty */
          // }
          srcStart += 4;
          break;
        }
        srcStart += 2;
      }
    } else if (code - 48 <= 9 || code == 45) {
      lastIndex = srcStart;
      srcStart += 2;
      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (code == COMMA || code == BRACKET_RIGHT || isSpace(code)) {
          // console.log("Value (number): " + ptrToStr(lastIndex, srcStart));
          out.push(JSON.Raw.from(ptrToStr(lastIndex, srcStart)));
          srcStart += 2;
          break;
        }
        srcStart += 2;
      }
    } else if (code == BRACE_LEFT) {
      lastIndex = srcStart;
      depth++;
      srcStart += 2;
      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (code == QUOTE) {
          srcStart += 2;
          while (!(load<u16>(srcStart) == QUOTE && load<u16>(srcStart - 2) != BACK_SLASH)) srcStart += 2;
        } else if (code == BRACE_RIGHT) {
          if (--depth == 0) {
            // console.log("Value (object): " + ptrToStr(lastIndex, srcStart + 2));
            out.push(JSON.Raw.from(ptrToStr(lastIndex, srcStart + 2)));
            srcStart += 4;
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
        if (code == QUOTE) {
          srcStart += 2;
          while (!(load<u16>(srcStart) == QUOTE && load<u16>(srcStart - 2) != BACK_SLASH)) srcStart += 2;
        } else if (code == BRACKET_RIGHT) {
          if (--depth == 0) {
            // console.log("Value (array): " + ptrToStr(lastIndex, srcStart + 2));
            out.push(JSON.Raw.from(ptrToStr(lastIndex, srcStart + 2)));
            srcStart += 4;
            break;
          }
        } else if (code == BRACKET_LEFT) depth++;
        srcStart += 2;
      }
    } else if (code == CHAR_T) {
      if (load<u64>(srcStart) == 28429475166421108) {
        // console.log("Value (true): " + ptrToStr(srcStart, srcStart + 8));
        out.push(JSON.Raw.from("true"));
        srcStart += 10;
      }
    } else if (code == CHAR_F) {
      if (load<u64>(srcStart, 2) == 28429466576093281) {
        // console.log("Value (false): " + ptrToStr(srcStart, srcStart + 10));
        out.push(JSON.Raw.from("false"));
        srcStart += 12;
      }
    } else if (code == CHAR_N) {
      if (load<u64>(srcStart) == 30399761348886638) {
        // console.log("Value (null): " + ptrToStr(srcStart, srcStart + 8));
        out.push(JSON.Raw.from("null"));
        srcStart += 10;
      }
    } else if (isSpace(code)) {
      srcStart += 2;
    } else {
      throw new Error("Unexpected character in JSON object '" + String.fromCharCode(code) + "' at position " + (srcEnd - srcStart).toString() + " " + ptrToStr(lastIndex, srcStart + 10));
    }
  }
  return out;
}
