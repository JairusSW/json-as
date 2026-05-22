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

// @ts-ignore: inline
@inline function scanFloatEnd(srcStart: usize, srcEnd: usize): usize {
  let ptr = srcStart;
  if (ptr < srcEnd && load<u16>(ptr) == 45) ptr += 2; // optional minus

  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (<u32>code - 48 > 9) break;
    ptr += 2;
  }

  if (ptr < srcEnd && load<u16>(ptr) == 46) {
    ptr += 2;
    while (ptr < srcEnd) {
      const code = load<u16>(ptr);
      if (<u32>code - 48 > 9) break;
      ptr += 2;
    }
  }

  if (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (code == 101 || code == 69) {
      ptr += 2;
      if (ptr < srcEnd) {
        const sign = load<u16>(ptr);
        if (sign == 45 || sign == 43) ptr += 2;
      }
      while (ptr < srcEnd) {
        const code = load<u16>(ptr);
        if (<u32>code - 48 > 9) break;
        ptr += 2;
      }
    }
  }

  return ptr;
}

// @ts-ignore: inline
@inline export function deserializeFloatField<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  const fieldPtr = dstObj + dstOffset;
  const end = scanFloatEnd(srcStart, srcEnd);

  if (sizeof<T>() == sizeof<f32>()) {
    store<f32>(fieldPtr, f32.parse(ptrToStr(srcStart, end)));
  } else {
    store<f64>(fieldPtr, f64.parse(ptrToStr(srcStart, end)));
  }

  return end;
}
