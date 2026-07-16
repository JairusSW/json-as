import { JSON } from "../..";
import { ptrToStr } from "../../util/ptrToStr";

export function deserializeRaw(
  srcStart: usize,
  srcEnd: usize,
  dst: usize = 0,
): JSON.Raw {
  const size = srcEnd - srcStart;
  if (dst) {
    const out = changetype<JSON.Raw>(dst);
    const data = changetype<string>(__renew(changetype<usize>(out.data), size));
    memory.copy(changetype<usize>(data), srcStart, size);
    out.data = data;
    return out;
  }
  return JSON.Raw.from(ptrToStr(srcStart, srcEnd));
}
