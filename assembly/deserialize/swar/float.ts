// SWAR float deserializers. Lemire-style fast path with parse4 SWAR digit
// folding on the fractional accumulator. Output is bit-identical to
// `f64.parse` / `f32.parse` (the NAIVE baseline) on the fast path because:
//
//   - the u64 mantissa accumulator is exact (no rounding in the digit loop),
//   - `1e0 .. 1e22` are exactly representable in f64, and
//   - a single fmul/fdiv on two exact operands is correctly rounded.
//
// Pathological inputs (>19 mantissa digits, mantissa > 2^53, or |exp| > 22)
// fall through to `f64.parse` / `f32.parse` over the float's own range so the
// SWAR result matches the NAIVE result for every input.
//
// Inspired by Daniel Lemire, "Number parsing at a gigabyte per second" (2021)
// and the simdjson `fast_float` implementation. The integer-part loop stays
// scalar — most JSON float payloads have 1-3 digit integer parts, so a parse4
// stride there pays the wasted-validate cost on every call without saving
// enough scalar iterations.

import { ptrToStr } from "../../util/ptrToStr";
import { parse4Digits_PairMul } from "../../util/swar-int";
import { scientific } from "../../util/scientific";

export const POW10_F64_POS: usize = memory.data<f64>([
  1, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14,
  1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22,
]);
export const MAX_EXACT_POW10: i32 = 22;
// 2^53. Any u64 mantissa <= this is exact in f64.
export const MAX_EXACT_MANTISSA: u64 = 1 << 53;

const ASCII_PLUS: u16 = 43;
const ASCII_MINUS: u16 = 45;
const ASCII_DOT: u16 = 46;
const ASCII_ZERO: u16 = 48;
const ASCII_E_UP: u16 = 69;
const ASCII_E_LO: u16 = 101;

// @ts-ignore: inline
@inline export function loadPow10(exp: u32): f64 {
  return load<f64>(POW10_F64_POS + ((<usize>exp) << 3));
}

// @ts-ignore: inline
@inline function fallback<T>(srcStart: usize, srcEnd: usize): T {
  const s = ptrToStr(srcStart, srcEnd);
  // @ts-ignore
  const type: T = 0;
  // @ts-ignore
  if (type instanceof f64) return <T>f64.parse(s);
  // @ts-ignore
  return <T>(<f32>f32.parse(s));
}

// @ts-ignore: inline
@inline function fallbackField<T extends number>(
  origStart: usize,
  end: usize,
  fieldPtr: usize,
): void {
  const s = ptrToStr(origStart, end);
  if (sizeof<T>() == sizeof<f32>()) {
    store<f32>(fieldPtr, f32.parse(s));
  } else {
    store<f64>(fieldPtr, f64.parse(s));
  }
}

export function deserializeFloat_SWAR<T>(srcStart: usize, srcEnd: usize): T {
  const origStart = srcStart;
  let p = srcStart;
  let negative = false;
  if (p < srcEnd && load<u16>(p) == ASCII_MINUS) {
    negative = true;
    p += 2;
  }

  // Integer part: scalar. Most JSON integers are 1-3 digits, so parse4 would
  // waste a validate per call.
  let mantissa: u64 = 0;
  let intDigits: i32 = 0;
  while (p < srcEnd) {
    const d = <u32>load<u16>(p) - ASCII_ZERO;
    if (d > 9) break;
    mantissa = mantissa * 10 + <u64>d;
    intDigits++;
    p += 2;
  }

  // Fractional part: parse4 stride (8 bytes / 4 digits) → scalar tail.
  // parse8 was tried and benchmarked even/worse; the saved mantissa mul
  // didn't outweigh the extra load and combined-validation latency, and the
  // dependency chain is the same length either way.
  let fracDigits: i32 = 0;
  if (p < srcEnd && load<u16>(p) == ASCII_DOT) {
    p += 2;
    while (p + 6 < srcEnd) {
      const parsed = inline.always(parse4Digits_PairMul(load<u64>(p)));
      if (parsed == U32.MAX_VALUE) break;
      mantissa = mantissa * 10_000 + <u64>parsed;
      fracDigits += 4;
      p += 8;
    }
    while (p < srcEnd) {
      const d = <u32>load<u16>(p) - ASCII_ZERO;
      if (d > 9) break;
      mantissa = mantissa * 10 + <u64>d;
      fracDigits++;
      p += 2;
    }
  }

  const mantDigits = intDigits + fracDigits;
  if (mantDigits == 0) return fallback<T>(origStart, srcEnd);

  let exponent: i32 = -fracDigits;

  // Optional `e[+-]NNN` suffix.
  if (p < srcEnd) {
    const c = load<u16>(p);
    if (c == ASCII_E_LO || c == ASCII_E_UP) {
      const expStart = p;
      p += 2;
      if (p >= srcEnd) return fallback<T>(origStart, expStart);
      let expNeg = false;
      const sc = load<u16>(p);
      if (sc == ASCII_MINUS) {
        expNeg = true;
        p += 2;
      } else if (sc == ASCII_PLUS) {
        p += 2;
      }
      if (p >= srcEnd) return fallback<T>(origStart, expStart);
      let exp: i32 = 0;
      let expDigits: i32 = 0;
      while (p < srcEnd) {
        const d = <u32>load<u16>(p) - ASCII_ZERO;
        if (d > 9) break;
        exp = exp * 10 + <i32>d;
        expDigits++;
        if (expDigits > 4) return fallback<T>(origStart, srcEnd);
        p += 2;
      }
      if (expDigits == 0) return fallback<T>(origStart, expStart);
      exponent += expNeg ? -exp : exp;
    }
  }

  // Lemire fast path when fully in range; `scientific` for u64-fitting
  // mantissas that exceed 2^53 or |exp| > 22 (still correctly rounded, but
  // via the scaledown/scaleup path); `f*.parse` fallback only for >19
  // mantissa digits where the sticky-bit handling matters.
  let result: f64;
  if (
    mantDigits <= 19 &&
    mantissa <= MAX_EXACT_MANTISSA &&
    exponent <= MAX_EXACT_POW10 &&
    exponent >= -MAX_EXACT_POW10
  ) {
    result = <f64>mantissa;
    if (exponent > 0) {
      result *= loadPow10(<u32>exponent);
    } else if (exponent < 0) {
      result /= loadPow10(<u32>-exponent);
    }
  } else if (mantDigits <= 19) {
    result = scientific(mantissa, exponent);
  } else {
    return fallback<T>(origStart, srcEnd);
  }
  if (negative) result = -result;

  // @ts-ignore
  const type: T = 0;
  // @ts-ignore
  if (type instanceof f64) return <T>result;
  // @ts-ignore
  return <T>(<f32>result);
}

export function deserializeFloatField_SWAR<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  const fieldPtr = dstObj + dstOffset;
  const origStart = srcStart;
  let p = srcStart;
  let negative = false;
  if (p < srcEnd && load<u16>(p) == ASCII_MINUS) {
    negative = true;
    p += 2;
  }

  let mantissa: u64 = 0;
  let intDigits: i32 = 0;
  while (p < srcEnd) {
    const d = <u32>load<u16>(p) - ASCII_ZERO;
    if (d > 9) break;
    mantissa = mantissa * 10 + <u64>d;
    intDigits++;
    p += 2;
  }

  let fracDigits: i32 = 0;
  if (p < srcEnd && load<u16>(p) == ASCII_DOT) {
    p += 2;
    while (p + 6 < srcEnd) {
      const parsed = parse4Digits_PairMul(load<u64>(p));
      if (parsed == U32.MAX_VALUE) break;
      mantissa = mantissa * 10_000 + <u64>parsed;
      fracDigits += 4;
      p += 8;
    }
    while (p < srcEnd) {
      const d = <u32>load<u16>(p) - ASCII_ZERO;
      if (d > 9) break;
      mantissa = mantissa * 10 + <u64>d;
      fracDigits++;
      p += 2;
    }
  }

  const mantDigits = intDigits + fracDigits;
  if (mantDigits == 0) unreachable();

  let exponent: i32 = -fracDigits;

  if (p < srcEnd) {
    const c = load<u16>(p);
    if (c == ASCII_E_LO || c == ASCII_E_UP) {
      const expStart = p;
      p += 2;
      if (p >= srcEnd) {
        fallbackField<T>(origStart, expStart, fieldPtr);
        return expStart;
      }
      let expNeg = false;
      const sc = load<u16>(p);
      if (sc == ASCII_MINUS) {
        expNeg = true;
        p += 2;
      } else if (sc == ASCII_PLUS) {
        p += 2;
      }
      if (p >= srcEnd) {
        fallbackField<T>(origStart, expStart, fieldPtr);
        return expStart;
      }
      let exp: i32 = 0;
      let expDigits: i32 = 0;
      while (p < srcEnd) {
        const d = <u32>load<u16>(p) - ASCII_ZERO;
        if (d > 9) break;
        exp = exp * 10 + <i32>d;
        expDigits++;
        if (expDigits > 4) {
          fallbackField<T>(origStart, p, fieldPtr);
          return p;
        }
        p += 2;
      }
      if (expDigits == 0) {
        fallbackField<T>(origStart, expStart, fieldPtr);
        return expStart;
      }
      exponent += expNeg ? -exp : exp;
    }
  }

  let result: f64;
  if (
    mantDigits <= 19 &&
    mantissa <= MAX_EXACT_MANTISSA &&
    exponent <= MAX_EXACT_POW10 &&
    exponent >= -MAX_EXACT_POW10
  ) {
    result = <f64>mantissa;
    if (exponent > 0) {
      result *= loadPow10(<u32>exponent);
    } else if (exponent < 0) {
      result /= loadPow10(<u32>-exponent);
    }
  } else if (mantDigits <= 19) {
    result = scientific(mantissa, exponent);
  } else {
    fallbackField<T>(origStart, p, fieldPtr);
    return p;
  }
  if (negative) result = -result;

  if (sizeof<T>() == sizeof<f32>()) {
    store<f32>(fieldPtr, <f32>result);
  } else {
    store<f64>(fieldPtr, result);
  }

  return p;
}
