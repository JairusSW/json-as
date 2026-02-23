import { JSON } from "../..";
import { ptrToStr } from "../../util/ptrToStr";

// @ts-ignore: inline
@inline export function deserializeRaw(srcStart: usize, srcEnd: usize): JSON.Raw {
  return JSON.Raw.from(ptrToStr(srcStart, srcEnd));
}
