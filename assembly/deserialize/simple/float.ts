import { ptrToStr } from "../../util/ptrToStr";
import { fastDoubleParse } from "../../util/fast-double-parser";

const FAST_DOUBLE_SCRATCH = memory.data(8);

// @ts-ignore: inline
@inline function pow10Fast(exponent: u32): f64 {
  if (exponent == 0) return 1.0;
  if (exponent == 1) return 10.0;
  if (exponent == 2) return 100.0;
  if (exponent == 3) return 1e3;
  if (exponent == 4) return 1e4;
  if (exponent == 5) return 1e5;
  if (exponent == 6) return 1e6;
  if (exponent == 7) return 1e7;
  if (exponent == 8) return 1e8;
  if (exponent == 9) return 1e9;
  if (exponent == 10) return 1e10;
  if (exponent == 11) return 1e11;
  if (exponent == 12) return 1e12;
  if (exponent == 13) return 1e13;
  if (exponent == 14) return 1e14;
  if (exponent == 15) return 1e15;
  if (exponent == 16) return 1e16;
  if (exponent == 17) return 1e17;
  if (exponent == 18) return 1e18;
  let result = 1.0;
  if (exponent & 1) result *= 1e1;
  if (exponent & 2) result *= 1e2;
  if (exponent & 4) result *= 1e4;
  if (exponent & 8) result *= 1e8;
  if (exponent & 16) result *= 1e16;
  if (exponent & 32) result *= 1e32;
  if (exponent & 64) result *= 1e64;
  if (exponent & 128) result *= 1e128;
  if (exponent & 256) result *= 1e256;
  return result;
}

// @ts-ignore: inline
@inline export function deserializeFloat<T>(srcStart: usize, srcEnd: usize): T {
  const fastEnd = fastDoubleParse(srcStart, srcEnd, FAST_DOUBLE_SCRATCH);
  if (fastEnd != 0) {
    const value = load<f64>(FAST_DOUBLE_SCRATCH);
    // @ts-ignore
    const type: T = 0;
    // @ts-ignore
    if (type instanceof f64) return <T>value;
    // @ts-ignore
    return <T>(<f32>value);
  }

  let negative = false;
  if (load<u16>(srcStart) == 45) {
    negative = true;
    srcStart += 2;
    if (srcStart >= srcEnd) unreachable();
  }

  let value: f64 = 0.0;
  let seenDigit = false;

  while (srcStart < srcEnd) {
    const digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10.0 + <f64>digit;
    seenDigit = true;
    srcStart += 2;
  }

  if (srcStart < srcEnd && load<u16>(srcStart) == 46) {
    srcStart += 2;
    let fraction: u64 = 0;
    let digits: u32 = 0;
    while (srcStart < srcEnd) {
      const digit = <u32>load<u16>(srcStart) - 48;
      if (digit > 9) break;
      fraction = fraction * 10 + digit;
      digits += 1;
      seenDigit = true;
      srcStart += 2;
    }
    if (digits != 0) value += <f64>fraction / pow10Fast(digits);
  }

  if (!seenDigit) {
    // @ts-ignore
    const type: T = 0;
    // @ts-ignore
    if (type instanceof f64) return f64.parse(ptrToStr(srcStart, srcEnd));
    // @ts-ignore
    return f32.parse(ptrToStr(srcStart, srcEnd));
  }

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
        const digit = <u32>load<u16>(srcStart) - 48;
        if (digit > 9) break;
        exponent = exponent * 10 + digit;
        srcStart += 2;
      }

      const power = pow10Fast(exponent);
      value = exponentNegative ? value / power : value * power;
    }
  }

  if (negative) value = -value;

  // @ts-ignore
  const type: T = 0;
  // @ts-ignore
  if (type instanceof f64) return <T>value;
  // @ts-ignore
  return <T>(<f32>value);
}

// @ts-ignore: inline
@inline export function deserializeFloatField<T extends number>(srcStart: usize, srcEnd: usize, dstObj: usize, dstOffset: usize = 0): usize {
  const fieldPtr = dstObj + dstOffset;
  const fastEnd = fastDoubleParse(srcStart, srcEnd, FAST_DOUBLE_SCRATCH);
  if (fastEnd != 0) {
    const value = load<f64>(FAST_DOUBLE_SCRATCH);
    if (sizeof<T>() == sizeof<f32>()) {
      store<f32>(fieldPtr, <f32>value);
    } else {
      store<f64>(fieldPtr, value);
    }
    return fastEnd;
  }

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
    let fraction: u64 = 0;
    let digits: u32 = 0;
    while (srcStart < srcEnd) {
      const code = load<u16>(srcStart);
      const digit = <u32>code - 48;
      if (digit > 9) break;
      fraction = fraction * 10 + digit;
      digits += 1;
      seenDigit = true;
      srcStart += 2;
    }
    if (digits != 0) value += <f64>fraction / pow10Fast(digits);
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

      const power = pow10Fast(exponent);
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
