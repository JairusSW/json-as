import { JSON } from "../..";
import {
  BACK_SLASH,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  BRACE_LEFT,
  BRACE_RIGHT,
  CHAR_F,
  CHAR_N,
  CHAR_T,
  COMMA,
  QUOTE,
} from "../../custom/chars";
import { isSpace, atoi } from "../../util";

export function deserializeSet<T extends Set<any>>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );

  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  if (srcStart >= srcEnd)
    throw new Error("Input string had zero length or was all whitespace");
  if (load<u16>(srcStart) != BRACKET_LEFT)
    throw new Error("Expected '[' at start of set");
  if (load<u16>(srcEnd - 2) != BRACKET_RIGHT)
    throw new Error("Expected ']' at end of set");

  srcStart += 2;

  while (srcStart < srcEnd - 2) {
    let code = load<u16>(srcStart);
    while (isSpace(code)) code = load<u16>((srcStart += 2));

    // @ts-ignore: type
    if (isString<indexof<T>>()) {
      if (code == QUOTE) {
        const lastIndex = srcStart;
        srcStart += 2;
        while (srcStart < srcEnd) {
          const c = load<u16>(srcStart);
          if (c == QUOTE && load<u16>(srcStart - 2) != BACK_SLASH) {
            // @ts-ignore: type
            out.add(JSON.__deserialize<indexof<T>>(lastIndex, srcStart + 2));
            srcStart += 2;
            break;
          }
          srcStart += 2;
        }
      }
      // @ts-ignore: type
    } else if (isBoolean<indexof<T>>()) {
      if (code == CHAR_T) {
        // @ts-ignore: type
        out.add(<indexof<T>>true);
        srcStart += 8;
      } else if (code == CHAR_F) {
        // @ts-ignore: type
        out.add(<indexof<T>>false);
        srcStart += 10;
      }
      // @ts-ignore: type
    } else if (isInteger<indexof<T>>()) {
      if (code - 48 <= 9 || code == 45) {
        const lastIndex = srcStart;
        srcStart += 2;
        while (srcStart < srcEnd) {
          const c = load<u16>(srcStart);
          if (c == COMMA || c == BRACKET_RIGHT || isSpace(c)) {
            // @ts-ignore: type
            out.add(atoi<indexof<T>>(lastIndex, srcStart));
            break;
          }
          srcStart += 2;
        }
      }
      // @ts-ignore: type
    } else if (isFloat<indexof<T>>()) {
      if (code - 48 <= 9 || code == 45) {
        const lastIndex = srcStart;
        srcStart += 2;
        while (srcStart < srcEnd) {
          const c = load<u16>(srcStart);
          if (c == COMMA || c == BRACKET_RIGHT || isSpace(c)) {
            // @ts-ignore: type
            out.add(JSON.__deserialize<indexof<T>>(lastIndex, srcStart));
            break;
          }
          srcStart += 2;
        }
      }
      // @ts-ignore: type
    } else if (isManaged<indexof<T>>() || isReference<indexof<T>>()) {
      // @ts-ignore: type
      const type = changetype<nonnull<indexof<T>>>(0);
      if (code == BRACE_LEFT) {
        // Object
        const lastIndex = srcStart;
        let depth: u32 = 1;
        srcStart += 2;
        while (srcStart < srcEnd) {
          const c = load<u16>(srcStart);
          if (c == QUOTE) {
            srcStart += 2;
            while (
              !(
                load<u16>(srcStart) == QUOTE &&
                load<u16>(srcStart - 2) != BACK_SLASH
              )
            )
              srcStart += 2;
          } else if (c == BRACE_RIGHT) {
            if (--depth == 0) {
              srcStart += 2;
              // @ts-ignore: type
              out.add(JSON.__deserialize<indexof<T>>(lastIndex, srcStart));
              break;
            }
          } else if (c == BRACE_LEFT) {
            depth++;
          }
          srcStart += 2;
        }
      } else if (code == BRACKET_LEFT) {
        // Nested array/set
        const lastIndex = srcStart;
        let depth: u32 = 1;
        srcStart += 2;
        while (srcStart < srcEnd) {
          const c = load<u16>(srcStart);
          if (c == BRACKET_RIGHT) {
            if (--depth == 0) {
              srcStart += 2;
              // @ts-ignore: type
              out.add(JSON.__deserialize<indexof<T>>(lastIndex, srcStart));
              break;
            }
          } else if (c == BRACKET_LEFT) {
            depth++;
          }
          srcStart += 2;
        }
      } else if (type instanceof JSON.Raw) {
        // Handle JSON.Raw
        if (code == QUOTE) {
          const lastIndex = srcStart;
          srcStart += 2;
          while (srcStart < srcEnd) {
            const c = load<u16>(srcStart);
            if (c == QUOTE && load<u16>(srcStart - 2) != BACK_SLASH) {
              // @ts-ignore: type
              out.add(JSON.__deserialize<indexof<T>>(lastIndex, srcStart + 2));
              srcStart += 2;
              break;
            }
            srcStart += 2;
          }
        } else if (code - 48 <= 9 || code == 45) {
          const lastIndex = srcStart;
          srcStart += 2;
          while (srcStart < srcEnd) {
            const c = load<u16>(srcStart);
            if (c == COMMA || c == BRACKET_RIGHT || isSpace(c)) {
              // @ts-ignore: type
              out.add(JSON.__deserialize<indexof<T>>(lastIndex, srcStart));
              break;
            }
            srcStart += 2;
          }
        } else if (code == CHAR_T) {
          // @ts-ignore: type
          out.add(JSON.__deserialize<indexof<T>>(srcStart, srcStart + 8));
          srcStart += 8;
        } else if (code == CHAR_F) {
          // @ts-ignore: type
          out.add(JSON.__deserialize<indexof<T>>(srcStart, srcStart + 10));
          srcStart += 10;
        } else if (code == CHAR_N) {
          // @ts-ignore: type
          out.add(JSON.__deserialize<indexof<T>>(srcStart, srcStart + 8));
          srcStart += 8;
        }
      }
    }
    srcStart += 2;
  }

  return out;
}
