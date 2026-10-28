// Direct decimal-to-f64 conversion from a `(u64 mantissa, i32 decimal exp)`
// pair. Small exact values use Clinger's fast path; the rest use a wide
// Eisel-Lemire product so inputs above 2^53 and wide exponents remain correctly
// rounded without allocating and reparsing a string.

import { eiselLemireWide } from "./eisel-lemire-wide";

const POWERS10: usize = memory.data<f64>([
  1, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14,
  1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22,
]);

function pow10(n: i32): f64 {
  return load<f64>(POWERS10 + ((<usize>n) << alignof<f64>()));
}

/**
 * Construct a correctly rounded f64 from a u64 mantissa and decimal exponent.
 * This intentionally does not delegate to AssemblyScript's legacy parser,
 * which is one ULP off for some wide exponents.
 *
 * Caller guarantees the digit run that produced `significand` was already
 * scanned and validated; this function only handles the value computation,
 * not the lexing.
 *
 * @param significand u64 mantissa (any value from 0 to U64.MAX_VALUE)
 * @param exp Decimal exponent (e.g. for "12.34" pass 1234 and -2)
 * @returns The correctly rounded f64, or 0 / Infinity at the extremes.
 */
export function scientific(significand: u64, exp: i32): f64 {
  if (!significand || exp < -342) return 0;
  if (exp > 308) return Infinity;
  const significandf = <f64>significand;
  if (!exp) return significandf;
  if (significand <= 9007199254740991 && abs(exp) <= 22) {
    if (exp > 0) return significandf * pow10(exp);
    return significandf / pow10(-exp);
  }
  return eiselLemireWide(significand, exp);
}
