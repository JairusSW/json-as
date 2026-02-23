import { BRACKET_LEFT, BRACKET_RIGHT } from "../../../custom/chars";
import { JSON } from "../../../";

export function deserializeArrayArray<T extends unknown[][]>(srcStart: usize, srcEnd: usize, dst: usize): T {
  const out = changetype<nonnull<T>>(dst || changetype<usize>(instantiate<T>()));
  let lastIndex: usize = 0;
  let depth: u32 = 0;
  srcStart += 2;
  while (srcStart < srcEnd - 2) {
    const code = load<u16>(srcStart);
    if (code == BRACKET_LEFT && depth++ == 0) {
      lastIndex = srcStart;
    } else if (code == BRACKET_RIGHT && --depth == 0) {
      out.push(JSON.__deserialize<valueof<T>>(lastIndex, srcStart + 2));
    }
    srcStart += 2;
  }
  return out;
}
