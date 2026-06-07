import { JSON } from "../..";
import { ptrToStr } from "../../util/ptrToStr";

export function deserializeRaw(srcStart: usize, srcEnd: usize): JSON.Raw {
  return JSON.Raw.from(ptrToStr(srcStart, srcEnd));
}
