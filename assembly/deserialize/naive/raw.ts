import { claimStringBuffer, invalidateStringFieldTrace } from "../parseMode";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { STRING_SIZE_MASK } from "../../util/runtime";
import { JSON } from "../..";
import { ptrToStr } from "../../util/ptrToStr";
import { __heap_base } from "memory";

export function deserializeRaw<T extends JSON.Raw = JSON.Raw>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize = 0,
): T {
  const size = srcEnd - srcStart;
  if (dst) {
    const out = changetype<T>(dst);
    const current = changetype<usize>(out.data);
    // Literal strings have static headers, not allocator headers. Match the
    // string-field decoders: only renew storage owned by the managed heap.
    let data: string;
    if (
      current >= __heap_base &&
      claimStringBuffer(current, dst + offsetof<JSON.Raw>("data"))
    ) {
      invalidateStringFieldTrace(current, true);
      const object = changetype<OBJECT>(current - TOTAL_OVERHEAD);
      if (<usize>(object.rtSize & STRING_SIZE_MASK) == size) {
        object.rtSize = <u32>size;
        data = out.data;
      } else data = changetype<string>(__renew(current, size));
    } else data = changetype<string>(__new(size, idof<string>()));
    memory.copy(changetype<usize>(data), srcStart, size);
    out.data = data;
    return out;
  }
  return instantiate<T>(ptrToStr(srcStart, srcEnd));
}
