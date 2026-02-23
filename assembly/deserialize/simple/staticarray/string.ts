import { JSON } from "../../..";
import { BACK_SLASH, QUOTE } from "../../../custom/chars";

export function deserializeStaticArrayString(srcStart: usize, srcEnd: usize, dst: usize): StaticArray<string> {
  // First pass: count elements using same logic as Array deserializer
  let count: i32 = 0;
  let ptr = srcStart;
  let inString = false;
  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (code == QUOTE) {
      if (!inString) {
        inString = true;
      } else if (load<u16>(ptr - 2) != BACK_SLASH) {
        count++;
        inString = false;
      }
    }
    ptr += 2;
  }

  // Allocate StaticArray with correct size
  const outSize = (<usize>count) << alignof<string>();
  const out = changetype<StaticArray<string>>(dst || __new(outSize, idof<StaticArray<string>>()));

  // Second pass: populate values
  let index = 0;
  let lastPos: usize = 0;
  inString = false;
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code == QUOTE) {
      if (!inString) {
        inString = true;
        lastPos = srcStart;
      } else if (load<u16>(srcStart - 2) != BACK_SLASH) {
        unchecked((out[index++] = JSON.__deserialize<string>(lastPos, srcStart + 2)));
        inString = false;
      }
    }
    srcStart += 2;
  }

  return out;
}
