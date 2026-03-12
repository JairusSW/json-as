import { ptrToStr } from "../util/ptrToStr";

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
@inline export function deserializeFloatField<T extends number>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  let negative = false;
  if (load<u16>(srcStart) == 45) {
    negative = true;
    srcStart += 2;
    if (srcStart >= srcEnd) unreachable();
  }

  let value: f64 = 0.0;
  let seenDigit = false;

  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    const digit = <u32>code - 48;
    if (digit > 9) break;
    value = value * 10.0 + <f64>digit;
    seenDigit = true;
    srcStart += 2;
  }

  if (srcStart < srcEnd && load<u16>(srcStart) == 46) {
    srcStart += 2;
    let scale = 0.1;
    while (srcStart < srcEnd) {
      const code = load<u16>(srcStart);
      const digit = <u32>code - 48;
      if (digit > 9) break;
      value += <f64>digit * scale;
      scale *= 0.1;
      seenDigit = true;
      srcStart += 2;
    }
  }

  if (!seenDigit) unreachable();

  if (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code == 101 || code == 69) {
      srcStart += 2;
      if (srcStart >= srcEnd) unreachable();

      let exponentNegative = false;
      let exponentCode = load<u16>(srcStart);
      if (exponentCode == 45 || exponentCode == 43) {
        exponentNegative = exponentCode == 45;
        srcStart += 2;
        if (srcStart >= srcEnd) unreachable();
        exponentCode = load<u16>(srcStart);
      }

      let exponent = <u32>exponentCode - 48;
      if (exponent > 9) unreachable();
      srcStart += 2;
      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        const digit = <u32>code - 48;
        if (digit > 9) break;
        exponent = exponent * 10 + digit;
        srcStart += 2;
      }

      let power = 1.0;
      while (exponent != 0) {
        power *= 10.0;
        exponent -= 1;
      }
      value = exponentNegative ? value / power : value * power;
    }
  }

  if (negative) value = -value;

  if (sizeof<T>() == sizeof<f32>()) {
    store<f32>(fieldPtr, <f32>value);
  } else {
    store<f64>(fieldPtr, value);
  }

  return srcStart;
}
