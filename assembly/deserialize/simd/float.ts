// SIMD float deserializers. Same Lemire-style fast path / `scientific()` /
// `f*.parse` cascade as `swar/float.ts`, but the fractional digit loop uses
// `parse8Digits_SIMD` (16 bytes / 8 digits) before falling through to
// `parse4Digits_PairMul` (8 bytes / 4 digits) and finally the scalar tail.
//
// Output is bit-identical to `f64.parse` / `f32.parse` for every input — the
// SIMD strides only change how the u64 mantissa is accumulated, not what it
// becomes.
//
// Requires `--enable simd` at compile time. Dead-code-eliminated when
// JSON_MODE != SIMD.

import { ptrToStr } from "../../util/ptrToStr";
import { parse4Digits_PairMul } from "../../util/swar-int";
import { parse16Digits_SIMD } from "../../util/simd-int";
import { scientific } from "../../util/scientific";
import { loadPow10, MAX_EXACT_MANTISSA, MAX_EXACT_POW10 } from "../swar/float";

const ASCII_PLUS: u16 = 43;
const ASCII_MINUS: u16 = 45;
const ASCII_DOT: u16 = 46;
const ASCII_ZERO: u16 = 48;
const ASCII_E_UP: u16 = 69;
const ASCII_E_LO: u16 = 101;

function fallback<T>(srcStart: usize, srcEnd: usize): T {
  const s = ptrToStr(srcStart, srcEnd);
  // @ts-ignore
  const type: T = 0;
  // @ts-ignore
  if (type instanceof f64) return <T>f64.parse(s);
  // @ts-ignore
  return <T>(<f32>f32.parse(s));
}

function fallbackField<T extends number>(
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

export function deserializeFloat_SIMD<T>(srcStart: usize, srcEnd: usize): T {
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

  // Fractional part: parse8 SIMD stride → parse4 SWAR stride → scalar tail.
  // `intDigits + fracDigits <= 11` gate keeps `mantissa * 10^8 + parsed8`
  // under u64 max even when the integer part is large.
  let fracDigits: i32 = 0;
  if (p < srcEnd && load<u16>(p) == ASCII_DOT) {
    p += 2;
    // parse16 SIMD only fires on long fractions (>=16 digits ahead, with
    // <=3 integer digits to keep mantissa * 1e16 under u64 max). Rare in
    // typical JSON but a big win when it does fire (8 digits per stride in
    // SWAR's parse8 was benched even/worse than parse4, so we skip parse8
    // entirely and let parse4 handle the 4-15 char tail).
    while (p + 30 < srcEnd && intDigits + fracDigits <= 3) {
      const parsed = parse16Digits_SIMD(p);
      if (parsed == U64.MAX_VALUE) break;
      mantissa = mantissa * 10_000_000_000_000_000 + parsed;
      fracDigits += 16;
      p += 32;
    }
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
  if (mantDigits == 0) return fallback<T>(origStart, srcEnd);

  let exponent: i32 = -fracDigits;

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

export function deserializeFloatField_SIMD<T extends number>(
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
    // parse16 SIMD only fires on long fractions (>=16 digits ahead, with
    // <=3 integer digits to keep mantissa * 1e16 under u64 max). Rare in
    // typical JSON but a big win when it does fire (8 digits per stride in
    // SWAR's parse8 was benched even/worse than parse4, so we skip parse8
    // entirely and let parse4 handle the 4-15 char tail).
    while (p + 30 < srcEnd && intDigits + fracDigits <= 3) {
      const parsed = parse16Digits_SIMD(p);
      if (parsed == U64.MAX_VALUE) break;
      mantissa = mantissa * 10_000_000_000_000_000 + parsed;
      fracDigits += 16;
      p += 32;
    }
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
