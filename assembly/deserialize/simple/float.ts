import { ptrToStr } from "../../util/ptrToStr";

// @ts-ignore: inline
@inline export function deserializeFloat<T>(srcStart: usize, srcEnd: usize): T {
  // @ts-ignore
  const type: T = 0;
  // @ts-ignore
  if (type instanceof f64) return f64.parse(ptrToStr(srcStart, srcEnd));
  // @ts-ignore
  return f32.parse(ptrToStr(srcStart, srcEnd));
}
