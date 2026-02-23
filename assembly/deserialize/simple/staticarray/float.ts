import { isSpace } from "../../../util";
import { COMMA, BRACKET_RIGHT } from "../../../custom/chars";
import { JSON } from "../../..";

export function deserializeStaticArrayFloat<T extends StaticArray<any>>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  let count: i32 = 0;
  let ptr = srcStart;
  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (code - 48 <= 9 || code == 45) {
      count++;
      ptr += 2;
      while (ptr < srcEnd) {
        const code = load<u16>(ptr);
        if (code == COMMA || code == BRACKET_RIGHT || isSpace(code)) break;
        ptr += 2;
      }
    }
    ptr += 2;
  }

  const outSize = count << (alignof<valueof<T>>());
  const out = changetype<nonnull<T>>(dst || __new(outSize, idof<T>()));

  let index = 0;
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code - 48 <= 9 || code == 45) {
      const lastIndex = srcStart;
      srcStart += 2;
      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (code == COMMA || code == BRACKET_RIGHT || isSpace(code)) {
          unchecked(
            (out[index++] = JSON.__deserialize<valueof<T>>(
              lastIndex,
              srcStart,
            )),
          );
          break;
        }
        srcStart += 2;
      }
    }
    srcStart += 2;
  }

  return out;
}
