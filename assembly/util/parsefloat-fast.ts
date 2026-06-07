import { ptrToStr } from "./ptrToStr";

// Lemire-style fast float parser.
//
// Reference: Daniel Lemire, "Number parsing at a gigabyte per second"
// (2021). https://arxiv.org/abs/2101.11408 — implemented in
// https://github.com/fastfloat/fast_float.
//
// The "fast path" applies when:
//   - the mantissa fits in a u64 (<=19 decimal digits), and
//   - the total decimal exponent is in [-22, 22], so the matching
//     `1e<exp>` power-of-ten is representable exactly in f64.
//
// In that regime `value = mantissa * 10^exp` rounds correctly under
// IEEE-754: both operands are exact in f64 and the single fmul is
// correctly rounded, so the result is the same as the strictly-rounded
// reference. This covers the overwhelming majority of JSON float
// payloads (most fields are <20 significant digits and modest
// exponents). Out-of-range inputs delegate to AS std's `f64.parse`
// (Grisu-based; correctly rounded for all f64).
//
// Compared to the original digit-by-digit accumulator (`value = value *
// 10.0 + digit`) this saves both wall-time (fewer fmul/fdiv) and
// precision (one rounding instead of N).

// 23-entry table: 10^0 .. 10^22, all exact in f64. f32 fast-paths can
// reuse the same table (since 10^k for k <= 22 fits in f32 only up to
// 10^7, but the multiplication is done in f64 and narrowed at the end).
const POW10_F64_POS: usize = memory.data<f64>([
  1, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14,
  1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22,
]);

const MAX_EXACT_POW10: i32 = 22;
// 2^53 = 9_007_199_254_740_992. Any u64 <= this is exact in f64.
const MAX_EXACT_MANTISSA: u64 = 1 << 53;

function loadPow10(exp: u32): f64 {
  return load<f64>(POW10_F64_POS + ((<usize>exp) << 3));
}

function fallback<T>(srcStart: usize, srcEnd: usize): T {
  const s = ptrToStr(srcStart, srcEnd);
  // @ts-ignore: type
  const type: T = 0;
  // @ts-ignore: type
  if (type instanceof f64) return <T>f64.parse(s);
  // @ts-ignore: cast
  return <T>(<f32>f32.parse(s));
}

/**
 * Fast path for `deserializeFloat`. `srcStart..srcEnd` must contain only
 * the float content (no surrounding whitespace, no `null`). Returns the
 * parsed value; on the slow path falls back to `f64.parse` /
 * `f32.parse` over the same range so behavior is preserved for every
 * input the previous parser accepted.
 *
 * Structure mirrors the existing parser's split integer/fraction loops
 * (TurboFan schedules these tighter than a single fused loop) but uses
 * u64 accumulators throughout so a 17-digit "3.141592653589793" stays
 * exact through accumulation and only loses precision at the final
 * `<f64>` cast.
 */
export function parseFloatFast<T>(srcStart: usize, srcEnd: usize): T {
  const origStart = srcStart;
  let p = srcStart;
  let negative = false;
  if (p < srcEnd && load<u16>(p) == 45) {
    negative = true;
    p += 2;
  }

  // Integer part.
  let mantissa: u64 = 0;
  let intDigits: i32 = 0;
  while (p < srcEnd) {
    const d = <u32>load<u16>(p) - 48;
    if (d > 9) break;
    mantissa = mantissa * 10 + <u64>d;
    intDigits++;
    p += 2;
  }

  // Optional fractional part.
  let fracDigits: i32 = 0;
  if (p < srcEnd && load<u16>(p) == 46) {
    p += 2;
    while (p < srcEnd) {
      const d = <u32>load<u16>(p) - 48;
      if (d > 9) break;
      mantissa = mantissa * 10 + <u64>d;
      fracDigits++;
      p += 2;
    }
  }

  const mantDigits = intDigits + fracDigits;
  if (mantDigits == 0) {
    // No digits seen (e.g. `.5`, `NaN`, `Infinity`) - defer to AS std.
    return fallback<T>(origStart, srcEnd);
  }

  let exponent: i32 = -fracDigits;

  // Optional `e[+-]NNN` suffix.
  if (p < srcEnd) {
    const c = load<u16>(p);
    if (c == 101 || c == 69) {
      p += 2;
      if (p >= srcEnd) return fallback<T>(origStart, srcEnd);
      let expNeg = false;
      const sc = load<u16>(p);
      if (sc == 45) {
        expNeg = true;
        p += 2;
      } else if (sc == 43) {
        p += 2;
      }
      if (p >= srcEnd) return fallback<T>(origStart, srcEnd);
      let exp: i32 = 0;
      let expDigits: i32 = 0;
      while (p < srcEnd) {
        const d = <u32>load<u16>(p) - 48;
        if (d > 9) break;
        exp = exp * 10 + <i32>d;
        expDigits++;
        if (expDigits > 4) {
          // Pathological exponent - fall back for safety.
          return fallback<T>(origStart, srcEnd);
        }
        p += 2;
      }
      if (expDigits == 0) return fallback<T>(origStart, srcEnd);
      exponent += expNeg ? -exp : exp;
    }
  }

  // Fast path eligibility: mantissa fits exactly in an f64 and exponent
  // is in the exactly-representable pow10 range. Both halves are needed
  // for the result to be correctly rounded. Capping `mantDigits` at 19
  // is a cheaper proxy for "didn't overflow u64".
  if (mantDigits > 19 || mantissa > MAX_EXACT_MANTISSA) {
    return fallback<T>(origStart, srcEnd);
  }
  if (exponent > MAX_EXACT_POW10 || exponent < -MAX_EXACT_POW10) {
    return fallback<T>(origStart, srcEnd);
  }

  let result = <f64>mantissa;
  if (exponent > 0) {
    result *= loadPow10(<u32>exponent);
  } else if (exponent < 0) {
    result /= loadPow10(<u32>-exponent);
  }
  if (negative) result = -result;

  // @ts-ignore: type
  const type: T = 0;
  // @ts-ignore: type
  if (type instanceof f64) return <T>result;
  // @ts-ignore: cast
  return <T>(<f32>result);
}
