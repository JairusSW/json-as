import { JSON } from "../..";
import { BACK_SLASH, COMMA, CHAR_F, BRACE_LEFT, BRACKET_LEFT, CHAR_N, QUOTE, BRACE_RIGHT, BRACKET_RIGHT, CHAR_T, COLON } from "../../custom/chars";
import { isSpace, isUnescapedQuote, scanStringEnd } from "../../util";
import { scanValueEnd } from "../swar/array/shared";

// @ts-ignore: Decorator is valid here
@inline function deserializeMapKey<T>(start: usize, end: usize): T {
  const keyText = JSON.__deserialize<string>(start - 2, end + 2);
  if (isString<T>()) return changetype<T>(keyText);
  return JSON.parse<T>(keyText);
}

export function deserializeMap<T extends Map<any, any>>(srcStart: usize, srcEnd: usize, dst: usize): T {
  const out = changetype<nonnull<T>>(dst || changetype<usize>(instantiate<T>()));

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
      if (code == QUOTE && isUnescapedQuote(srcStart)) {
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
        srcStart = scanStringEnd(srcStart, srcEnd);
        if (srcStart >= srcEnd) throw new Error("Unterminated string in JSON object");
        // @ts-ignore: type
        out.set(deserializeMapKey<indexof<T>>(keyStart, keyEnd), JSON.__deserialize<valueof<T>>(lastIndex, srcStart + 2));
        srcStart += 2;
        keyStart = 0;
        continue;
      } else if (code - 48 <= 9 || code == 45) {
        lastIndex = srcStart;
        srcStart += 2;
        while (srcStart < srcEnd) {
          const code = load<u16>(srcStart);
          if (code == COMMA || code == BRACE_RIGHT || isSpace(code)) {
            // console.log("Value (number): " + ptrToStr(lastIndex, srcStart));
            // @ts-ignore: type
            out.set(deserializeMapKey<indexof<T>>(keyStart, keyEnd), JSON.__deserialize<valueof<T>>(lastIndex, srcStart));
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
            srcStart = scanStringEnd(srcStart, srcEnd);
            if (srcStart >= srcEnd) throw new Error("Unterminated string in JSON object");
          } else if (code == BRACE_RIGHT) {
            if (--depth == 0) {
              // console.log("Value (object): " + ptrToStr(lastIndex, srcStart + 2));
              // @ts-ignore: type
              out.set(deserializeMapKey<indexof<T>>(keyStart, keyEnd), JSON.__deserialize<valueof<T>>(lastIndex, (srcStart += 2)));
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
            srcStart = scanStringEnd(srcStart, srcEnd);
            if (srcStart >= srcEnd) throw new Error("Unterminated string in JSON object");
          } else if (code == BRACKET_RIGHT) {
            if (--depth == 0) {
              // console.log("Value (array): " + ptrToStr(lastIndex, srcStart + 2));
              // @ts-ignore: type
              out.set(deserializeMapKey<indexof<T>>(keyStart, keyEnd), JSON.__deserialize<valueof<T>>(lastIndex, (srcStart += 2)));
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
          // @ts-ignore: type
          out.set(deserializeMapKey<indexof<T>>(keyStart, keyEnd), JSON.__deserialize<valueof<T>>(srcStart, (srcStart += 8)));
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
          // @ts-ignore: type
          out.set(deserializeMapKey<indexof<T>>(keyStart, keyEnd), JSON.__deserialize<valueof<T>>(srcStart, (srcStart += 10)));
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
          // @ts-ignore: type
          out.set(deserializeMapKey<indexof<T>>(keyStart, keyEnd), JSON.__deserialize<valueof<T>>(srcStart, (srcStart += 8)));
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

@inline export function deserializeMapField<T extends Map<any, any>>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  let out = load<T>(fieldPtr);
  if (!changetype<usize>(out)) {
    out = changetype<T>(instantiate<T>());
    store<T>(fieldPtr, out);
  } else {
    changetype<nonnull<T>>(out).clear();
  }

  if (srcStart >= srcEnd || load<u16>(srcStart) != BRACE_LEFT) throw new Error("Failed to parse JSON!");
  srcStart += 2;
  if (srcStart >= srcEnd) throw new Error("Failed to parse JSON!");
  if (load<u16>(srcStart) == BRACE_RIGHT) return srcStart + 2;

  while (srcStart < srcEnd) {
    if (load<u16>(srcStart) != QUOTE) break;

    const keyStart = srcStart + 2;
    const keyEnd = scanStringEnd(srcStart, srcEnd);
    if (keyEnd >= srcEnd) break;

    srcStart = keyEnd + 2;
    if (srcStart >= srcEnd || load<u16>(srcStart) != COLON) break;
    srcStart += 2;

    const valueEnd = scanValueEnd(srcStart, srcEnd);
    if (!valueEnd || valueEnd <= srcStart) break;

    // @ts-ignore: type
    changetype<nonnull<T>>(out).set(deserializeMapKey<indexof<T>>(keyStart, keyEnd), JSON.__deserialize<valueof<T>>(srcStart, valueEnd));
    srcStart = valueEnd;

    if (srcStart >= srcEnd) break;
    const code = load<u16>(srcStart);
    if (code == COMMA) {
      srcStart += 2;
      continue;
    }
    if (code == BRACE_RIGHT) return srcStart + 2;
    break;
  }

  throw new Error("Failed to parse JSON!");
}
