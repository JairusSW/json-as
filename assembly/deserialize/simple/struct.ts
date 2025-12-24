import { BACK_SLASH, COMMA, CHAR_F, BRACE_LEFT, BRACKET_LEFT, CHAR_N, QUOTE, BRACE_RIGHT, BRACKET_RIGHT, CHAR_T, COLON } from "../../custom/chars";
import { isSpace } from "../../util";

export function deserializeStruct<T>(srcStart: usize, srcEnd: usize, dst: usize): T {
  const out = changetype<nonnull<T>>(dst || __new(offsetof<T>(), idof<T>()));

  // @ts-ignore: supplied by transform
  if (isDefined(out.__INITIALIZE)) out.__INITIALIZE();

  let keyStart: usize = 0;
  let keyEnd: usize = 0;
  let isKey = false;
  let depth = 0;
  let lastIndex: usize = 0;

  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2; // would like to optimize this later

  if (srcStart - srcEnd == 0) throw new Error("Input string had zero length or was all whitespace");
  if (load<u16>(srcStart) != BRACE_LEFT) throw new Error("Expected '{' at start of object at position " + (srcEnd - srcStart).toString());
  if (load<u16>(srcEnd - 2) != BRACE_RIGHT) throw new Error("Expected '}' at end of object at position " + (srcEnd - srcStart).toString());

  srcStart += 2;
  while (srcStart < srcEnd) {
    let code = load<u16>(srcStart); // while (isSpace(code)) code = load<u16>(srcStart += 2);
    if (keyStart == 0) {
      if (code == QUOTE && load<u16>(srcStart - 2) !== BACK_SLASH) {
        if (isKey) {
          keyStart = lastIndex;
          keyEnd = srcStart;
          // console.log("Key: " + ptrToStr(lastIndex, srcStart));
          // console.log("Next: " + String.fromCharCode(load<u16>(srcStart + 2)));
          while (isSpace((code = load<u16>((srcStart += 2))))) {}
          if (code !== COLON) throw new Error("Expected ':' after key at position " + (srcEnd - srcStart).toString());
          isKey = false;
        } else {
          // console.log("Got key start");
          isKey = true; // i don't like this
          lastIndex = srcStart + 2;
        }
      }
      // isKey = !isKey;
      srcStart += 2;
    } else {
      if (code == QUOTE) {
        lastIndex = srcStart;
        srcStart += 2;
        while (srcStart < srcEnd) {
          const code = load<u16>(srcStart);
          if (code == QUOTE && load<u16>(srcStart - 2) !== BACK_SLASH) {
            // console.log("Value (string): " + ptrToStr(lastIndex, srcStart + 2));
            // @ts-ignore: exists
            out.__DESERIALIZE(keyStart, keyEnd, lastIndex, srcStart + 2, changetype<usize>(out));
            // while (isSpace(load<u16>(srcStart))) srcStart += 2;
            srcStart += 4;
            // console.log("Next: " + String.fromCharCode(load<u16>(srcStart)));
            keyStart = 0;
            break;
          }
          srcStart += 2;
        }
      } else if (code - 48 <= 9 || code == 45) {
        lastIndex = srcStart;
        srcStart += 2;
        while (srcStart < srcEnd) {
          const code = load<u16>(srcStart);
          if (code == COMMA || code == BRACE_RIGHT || isSpace(code)) {
            // console.log("Value (number): " + ptrToStr(lastIndex, srcStart));
            // @ts-ignore: exists
            out.__DESERIALIZE(keyStart, keyEnd, lastIndex, srcStart, changetype<usize>(out));
            // while (isSpace(load<u16>((srcStart += 2)))) {
            //   /* empty */
            // }
            srcStart += 2;
            // console.log("Next: " + String.fromCharCode(load<u16>(srcStart)));
            keyStart = 0;
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
              // @ts-ignore: exists
              out.__DESERIALIZE(keyStart, keyEnd, lastIndex, (srcStart += 2), changetype<usize>(out));
              // console.log("Next: " + String.fromCharCode(load<u16>(srcStart)));
              keyStart = 0;
              // while (isSpace(load<u16>(srcStart))) {
              //   /* empty */
              // }
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
              // @ts-ignore: exists
              out.__DESERIALIZE(keyStart, keyEnd, lastIndex, (srcStart += 2), changetype<usize>(out));
              // console.log("Next: " + String.fromCharCode(load<u16>(srcStart)));
              keyStart = 0;
              // while (isSpace(load<u16>((srcStart += 2)))) {
              //   /* empty */
              // }
              break;
            }
          } else if (code == BRACKET_LEFT) depth++;
          srcStart += 2;
        }
      } else if (code == CHAR_T) {
        if (load<u64>(srcStart) == 28429475166421108) {
          // console.log("Value (bool): " + ptrToStr(srcStart, srcStart + 8));
          // @ts-ignore: exists
          out.__DESERIALIZE(keyStart, keyEnd, srcStart, (srcStart += 8), changetype<usize>(out));
          // while (isSpace(load<u16>((srcStart += 2)))) {
          //   /* empty */
          // }
          srcStart += 2;
          // console.log("Next: " + String.fromCharCode(load<u16>(srcStart)) + "  " + (srcStart < srcEnd).toString());
          keyStart = 0;
        }
      } else if (code == CHAR_F) {
        if (load<u64>(srcStart, 2) == 28429466576093281) {
          // console.log("Value (bool): " + ptrToStr(srcStart, srcStart + 10));
          // @ts-ignore: exists
          out.__DESERIALIZE(keyStart, keyEnd, srcStart, (srcStart += 10), changetype<usize>(out));
          // while (isSpace(load<u16>((srcStart += 2)))) {
          //   /* empty */
          // }
          srcStart += 2;
          // console.log("Next: " + String.fromCharCode(load<u16>(srcStart)));
          keyStart = 0;
        }
      } else if (code == CHAR_N) {
        if (load<u64>(srcStart) == 30399761348886638) {
          // console.log("Value (null): " + ptrToStr(srcStart, srcStart + 8));
          // @ts-ignore: exists
          out.__DESERIALIZE(keyStart, keyEnd, srcStart, (srcStart += 8), changetype<usize>(out));
          // while (isSpace(load<u16>((srcStart += 2)))) {
          /* empty */
          // }
          srcStart += 2;
          // console.log("Next: " + String.fromCharCode(load<u16>(srcStart)));
          keyStart = 0;
        }
      } else if (isSpace(code)) {
        srcStart += 2;
      } else {
        throw new Error("Unexpected character in JSON object '" + String.fromCharCode(code) + "' at position " + (srcEnd - srcStart).toString());
      }
    }
  }
  return out;
}
