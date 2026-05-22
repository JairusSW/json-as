// Direct decimal-to-f64 conversion from a `(u64 mantissa, i32 decimal exp)`
// pair. Bit-identical to `f64.parse` / `f32.parse` for any input the SWAR
// float deserializer can produce.
//
// Ported from AssemblyScript std's `util/string.ts` (which itself is adapted
// from the "metallic" library). The reason we duplicate it: AS std exposes
// `strtod(str)` but the underlying `scientific(mantissa, exp)` helper is
// module-private. Going through `strtod` requires a string allocation and a
// re-parse of digits we've already accumulated in the SWAR loop. Calling
// `scientific` directly skips both costs.
//
// scientific() is correctly rounded for all u64 mantissas and decimal
// exponents that fit in IEEE-754 f64's range — including the [2^53, 2^64)
// mantissa range that breaks Lemire's single-fmul fast path.

const POWERS10: usize = memory.data<f64>([
  1, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14,
  1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22,
]);

// 5^i for i in [0, 13]. ipow32(5, e) for the exponent ranges scaledown
// and scaleup actually call it with.
const POWERS5: usize = memory.data<i32>([
  1, 5, 25, 125, 625, 3125, 15625, 78125, 390625, 1953125, 9765625, 48828125,
  244140625, 1220703125,
]);

// @ts-ignore: inline
@inline function pow10(n: i32): f64 {
  return load<f64>(POWERS10 + ((<usize>n) << alignof<f64>()));
}

// @ts-ignore: inline
@inline function pow5_32(n: i32): i32 {
  return load<i32>(POWERS5 + ((<usize>n) << alignof<i32>()));
}

// __fixmulShift is mutated by `fixmul` and read by `scaleup`. AS std uses a
// module-level @lazy variable for the same reason; matching that.
// @ts-ignore: lazy decorator
@lazy let __fixmulShift: u64 = 0;

// @ts-ignore: inline
@inline function fixmul(a: u64, b: u32): u64 {
  const low = (a & 0xffffffff) * b;
  const high = (a >> 32) * b + (low >> 32);
  const overflow = <u32>(high >> 32);
  const space = clz(overflow);
  const revspace: u64 = 32 - space;
  __fixmulShift += revspace;
  return (
    ((high << space) | ((low & 0xffffffff) >> revspace)) +
    (((low << space) >> 31) & 1)
  );
}

// @ts-ignore: inline
@inline function scaledown(significand: u64, exp: i32): f64 {
  const denom: u64 = 6103515625; // 1e14 * 0x1p-14
  const scale = reinterpret<f64>(0x3f06849b86a12b9b); // 1e-14 * 0x1p32

  let shift = clz(significand);
  significand <<= shift;
  shift = exp - shift;

  for (; exp <= -14; exp += 14) {
    const q = significand / denom;
    const r = significand % denom;
    const s = clz(q);
    significand = (q << s) + <u64>nearest(scale * <f64>(r << (s - 18)));
    shift -= s;
  }
  const b = <u64>pow5_32(-exp);
  const q = significand / b;
  const r = significand % b;
  const s = clz(q);
  significand =
    (q << s) +
    <u64>(reinterpret<f64>(reinterpret<u64>(<f64>r) + (s << 52)) / <f64>b);
  shift -= s;

  return NativeMath.scalbn(<f64>significand, <i32>shift);
}

// @ts-ignore: inline
@inline function scaleup(significand: u64, exp: i32): f64 {
  const coeff: u32 = 1220703125; // 1e13 * 0x1p-13;
  let shift = ctz(significand);
  significand >>= shift;
  shift += exp;

  __fixmulShift = shift;
  for (; exp >= 13; exp -= 13) {
    significand = fixmul(significand, coeff);
  }
  significand = fixmul(significand, <u32>pow5_32(exp));
  shift = __fixmulShift;
  return NativeMath.scalbn(<f64>significand, <i32>shift);
}

/**
 * Construct an f64 from a u64 mantissa and decimal exponent. Result is
 * correctly rounded — bit-identical to `f64.parse` for any input the SWAR
 * float deserializer can pre-parse into this form.
 *
 * Caller guarantees the digit run that produced `significand` was already
 * scanned and validated; this function only handles the value computation,
 * not the lexing.
 *
 * @param significand u64 mantissa (any value from 0 to U64.MAX_VALUE)
 * @param exp Decimal exponent (e.g. for "12.34" pass 1234 and -2)
 * @returns The correctly rounded f64, or 0 / Infinity at the extremes.
 */
// @ts-ignore: inline
@inline export function scientific(significand: u64, exp: i32): f64 {
  if (!significand || exp < -342) return 0;
  if (exp > 308) return Infinity;
  let significandf = <f64>significand;
  if (!exp) return significandf;
  if (exp > 22 && exp <= 22 + 15) {
    significandf *= pow10(exp - 22);
    exp = 22;
  }
  if (significand <= 9007199254740991 && abs(exp) <= 22) {
    if (exp > 0) return significandf * pow10(exp);
    return significandf / pow10(-exp);
  } else if (exp < 0) {
    return scaledown(significand, exp);
  } else {
    return scaleup(significand, exp);
  }
}
