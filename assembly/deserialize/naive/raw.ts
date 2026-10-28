import { JSON } from "../..";
import { ptrToStr } from "../../util/ptrToStr";
import { __heap_base } from "memory";

export function deserializeRaw(
  srcStart: usize,
  srcEnd: usize,
  dst: usize = 0,
): JSON.Raw {
  const size = srcEnd - srcStart;
  if (dst) {
    const out = changetype<JSON.Raw>(dst);
    const current = changetype<usize>(out.data);
    // Literal strings have static headers, not allocator headers. Match the
    // string-field decoders: only renew storage owned by the managed heap.
    const data = changetype<string>(
      current >= __heap_base
        ? __renew(current, size)
        : __new(size, idof<string>()),
    );
    memory.copy(changetype<usize>(data), srcStart, size);
    out.data = data;
    return out;
  }
  return JSON.Raw.from(ptrToStr(srcStart, srcEnd));
}
