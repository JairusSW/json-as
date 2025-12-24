import { BACK_SLASH } from "../../custom/chars";
import { DESERIALIZE_ESCAPE_TABLE, ESCAPE_HEX_TABLE } from "../../globals/tables";

// @ts-ignore: inline
@inline export function deserializeString(srcStart: usize, srcEnd: usize, dst: usize): string {
  srcStart += 2;
  srcEnd -= 2;
  const startPtr = srcStart;
  if (dst == 0) dst = __new(srcEnd - srcStart, idof<string>());
  let dstPtr = dst;
  let lastPtr = srcStart;
  while (srcStart < srcEnd) {
    let code = load<u16>(srcStart);
    if (code == BACK_SLASH) {
      code = <u16>load<u8>(DESERIALIZE_ESCAPE_TABLE + load<u8>(srcStart, 2));
      if (code == 117 && load<u32>(srcStart, 4) == 3145776) {
        const block = load<u32>(srcStart, 8);
        const codeA = block & 0xffff;
        const codeB = (block >> 16) & 0xffff;
        const escapedA = load<u8>(ESCAPE_HEX_TABLE + codeA);
        const escapedB = load<u8>(ESCAPE_HEX_TABLE + codeB);
        const escaped = (escapedA << 4) + escapedB;
        const remBytes = srcStart - lastPtr;
        memory.copy(dstPtr, lastPtr, remBytes);
        dstPtr += remBytes;
        store<u16>(dstPtr, escaped);
        dstPtr += 2;
        srcStart += 12;
        lastPtr = srcStart;
      } else {
        const remBytes = srcStart - lastPtr;
        memory.copy(dstPtr, lastPtr, remBytes);
        dstPtr += remBytes;
        store<u16>(dstPtr, code);
        dstPtr += 2;
        srcStart += 4;
        lastPtr = srcStart;
      }
    } else {
      srcStart += 2;
    }
  }

  const remBytes = srcEnd - lastPtr;
  memory.copy(dstPtr, lastPtr, remBytes);
  dstPtr += remBytes;

  if (lastPtr != startPtr) dst = __renew(dst, dstPtr - dst);
  return changetype<string>(dst);
}
