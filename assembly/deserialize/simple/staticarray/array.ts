import { BRACKET_LEFT, BRACKET_RIGHT } from "../../../custom/chars";
import { JSON } from "../../../";

export function deserializeStaticArrayArray<T extends StaticArray<any>>(srcStart: usize, srcEnd: usize, dst: usize): T {
  let count: i32 = 0;
  let depth: u32 = 0;
  let ptr = srcStart + 2;
  while (ptr < srcEnd - 2) {
    const code = load<u16>(ptr);
    if (code == BRACKET_LEFT && depth++ == 0) {
      // start of nested array
    } else if (code == BRACKET_RIGHT && --depth == 0) {
      count++;
    }
    ptr += 2;
  }

  const outSize = <usize>count << alignof<valueof<T>>();
  const out = changetype<nonnull<T>>(dst || __new(outSize, idof<T>()));

  // Second pass: populate values
  let index = 0;
  let lastIndex: usize = 0;
  depth = 0;
  srcStart += 2;
  while (srcStart < srcEnd - 2) {
    const code = load<u16>(srcStart);
    if (code == BRACKET_LEFT && depth++ == 0) {
      lastIndex = srcStart;
    } else if (code == BRACKET_RIGHT && --depth == 0) {
      unchecked((out[index++] = JSON.__deserialize<valueof<T>>(lastIndex, srcStart + 2)));
    }
    srcStart += 2;
  }

  return out;
}
