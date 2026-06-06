// Żmij — a double/float-to-string conversion algorithm based on Schubfach and
// xjb, ported to AssemblyScript from the C++ reference implementation at
// https://github.com/vitaut/zmij/ (Copyright (c) 2025 Victor Zverovich, MIT).
//
// WebAssembly is always little-endian, so all big-endian branches from the
// original are dropped. Digit generation has both a SWAR kernel and a WASM-SIMD
// kernel (selected at runtime via ASC_FEATURE_SIMD). The writers emit UTF-16
// (json-as strings are UTF-16) and format per ECMAScript Number::toString, so
// json-as output matches `JSON.stringify(JSON.parse(payload))`.
//
// Public API:
//   dtoa(value: f64): string             — shortest round-trip decimal string
//   ftoa(value: f32): string             — shortest round-trip decimal string
//   writeDoubleUnsafe(buf, value): usize — write UTF-16 to `buf`, return end ptr
//   writeFloatUnsafe(buf, value): usize  — write UTF-16 to `buf`, return end ptr
//   toDecimal(value: f64)                — {sig, exp, negative} decomposition

// ---------------------------------------------------------------------------
// Low-level integer helpers
// ---------------------------------------------------------------------------

// High 64 bits of the 128-bit product x * y (schoolbook, matches the C
// fallback umul128).
// @ts-ignore: decorator
@inline
function mulhi64(a: u64, b: u64): u64 {
  const a0 = a & 0xffffffff,
    a1 = a >> 32;
  const b0 = b & 0xffffffff,
    b1 = b >> 32;
  const w0 = a0 * b0;
  const t = a1 * b0 + (w0 >> 32);
  let w1 = t & 0xffffffff;
  const w2 = t >> 32;
  w1 = a0 * b1 + w1;
  return a1 * b1 + w2 + (w1 >> 32);
}

// Returns (x * y + c) >> 64.
// @ts-ignore: decorator
@inline
function umul128AddHi64(x: u64, y: u64, c: u64): u64 {
  const lo = x * y; // low 64 bits
  const hi = mulhi64(x, y);
  return hi + (lo + c < lo ? 1 : 0);
}

// @ts-ignore: decorator
@inline
function bswap64(x: u64): u64 {
  return bswap<u64>(x);
}

// Number of significant decimal digits packed (one digit per byte, little-end
// holding the most significant digit). Equivalent to 8 - clz(x)/8 with a
// sentinel so the zero case maps to 0.
// @ts-ignore: decorator
@inline
function countTrailingNonzeros(x: u64): i32 {
  return <i32>((70 - clz<u64>((x << 1) | 1)) / 8);
}

// x / 10 for x <= 2**62 (used only on the subnormal path).
// @ts-ignore: decorator
@inline
function div10(x: u64): u64 {
  return x / 10;
}

// ---------------------------------------------------------------------------
// Logarithm / shift approximations
// ---------------------------------------------------------------------------

// floor(log10(2**bin_exp)) if regular, else floor(log10(3/4 * 2**bin_exp)).
// @ts-ignore: decorator
@inline
function computeDecExp(binExp: i32, regular: bool = true): i32 {
  const log10_3_over_4_sig = 131072;
  const log10_2_sig = 315653,
    log10_2_exp = 20;
  return (
    (binExp * log10_2_sig - (regular ? 0 : log10_3_over_4_sig)) >> log10_2_exp
  );
}

// Shift that keeps a fixed 128-bit fractional part after scaling by 10**dec_exp.
// @ts-ignore: decorator
@inline
function computeExpShift(binExp: i32, decExp: i32): i32 {
  const log2_pow10_sig = 217707,
    log2_pow10_exp = 16;
  const pow10BinExp = (-decExp * log2_pow10_sig) >> log2_pow10_exp;
  return binExp + pow10BinExp + 1;
}

// ---------------------------------------------------------------------------
// Powers of ten — Dougall Johnson's method, computed on demand (compress mode)
// ---------------------------------------------------------------------------

// pow10_minor: 28 entries.
const POW10_MINOR = StaticArray.fromArray<u64>([
  0x8000000000000000, 0xa000000000000000, 0xc800000000000000,
  0xfa00000000000000, 0x9c40000000000000, 0xc350000000000000,
  0xf424000000000000, 0x9896800000000000, 0xbebc200000000000,
  0xee6b280000000000, 0x9502f90000000000, 0xba43b74000000000,
  0xe8d4a51000000000, 0x9184e72a00000000, 0xb5e620f480000000,
  0xe35fa931a0000000, 0x8e1bc9bf04000000, 0xb1a2bc2ec5000000,
  0xde0b6b3a76400000, 0x8ac7230489e80000, 0xad78ebc5ac620000,
  0xd8d726b7177a8000, 0x878678326eac9000, 0xa968163f0a57b400,
  0xd3c21bcecceda100, 0x84595161401484a0, 0xa56fa5b99019a5c8,
  0xcecb8f27f4200f3a,
]);

// pow10_major: 23 entries of {hi, lo}, stored flat as hi0, lo0, hi1, lo1, ...
const POW10_MAJOR = StaticArray.fromArray<u64>([
  0xaf8e5410288e1b6f,
  0x07ecf0ae5ee44dda, // -303
  0xb1442798f49ffb4a,
  0x99cd11cfdf41779d, // -275
  0xb2fe3f0b8599ef07,
  0x861fa7e6dcb4aa15, // -247
  0xb4bca50b065abe63,
  0x0fed077a756b53aa, // -219
  0xb67f6455292cbf08,
  0x1a3bc84c17b1d543, // -191
  0xb84687c269ef3bfb,
  0x3d5d514f40eea742, // -163
  0xba121a4650e4ddeb,
  0x92f34d62616ce413, // -135
  0xbbe226efb628afea,
  0x890489f70a55368c, // -107
  0xbdb6b8e905cb600f,
  0x5400e987bbc1c921, //  -79
  0xbf8fdb78849a5f96,
  0xde98520472bdd034, //  -51
  0xc16d9a0095928a27,
  0x75b7053c0f178294, //  -23
  0xc350000000000000,
  0x0000000000000000, //    5
  0xc5371912364ce305,
  0x6c28000000000000, //   33
  0xc722f0ef9d80aad6,
  0x424d3ad2b7b97ef6, //   61
  0xc913936dd571c84c,
  0x03bc3a19cd1e38ea, //   89
  0xcb090c8001ab551c,
  0x5cadf5bfd3072cc6, //  117
  0xcd036837130890a1,
  0x36dba887c37a8c10, //  145
  0xcf02b2c21207ef2e,
  0x94f967e45e03f4bc, //  173
  0xd106f86e69d785c7,
  0xe13336d701beba52, //  201
  0xd31045a8341ca07c,
  0x1ede48111209a051, //  229
  0xd51ea6fa85785631,
  0x552a74227f3ea566, //  257
  0xd732290fbacaf133,
  0xa97c177947ad4096, //  285
  0xd94ad8b1c7380874,
  0x18375281ae7822bc, //  313
]);

const POW10_FIXUPS = StaticArray.fromArray<u32>([
  0x0a4e363f, 0x00001840, 0x00006400, 0x24200040, 0x00000000, 0x0c000000,
  0x82c81380, 0x5e4ce01f, 0xd730f60f, 0x0000001b, 0x00000000, 0xcdf7fffc,
  0x6e8201d8, 0x40cd3fd1, 0xdb642501, 0x00000d0d, 0x14042400, 0x53713840,
  0x11781db4, 0x00000000,
]);

// Result of the most recent loadPow10 call.
let gPow10Hi: u64 = 0;
let gPow10Lo: u64 = 0;

// The 128-bit significand of 10**i (Dougall Johnson's method) is the same for
// every conversion at a given decimal exponent, but recomputing it on demand
// costs ~10 multiplies on the hot path. Precompute all of them once at module
// init into a flat table (~9.7 KB); the conversion path then does a single load.
// Observed index range over the full f64/f32 domain is [0, 616]; 618 covers it.
const POW10_COUNT = 618;
const POW10_TABLE = memory.data(POW10_COUNT * 16);

for (let i = 0; i < POW10_COUNT; i++) {
  const stride = 28;
  const m = POW10_MINOR[(i + 10) % stride];
  const hj = ((i + 10) / stride) << 1;
  const hHi = POW10_MAJOR[hj];
  const hLo = POW10_MAJOR[hj + 1];

  const h1 = mulhi64(hLo, m);
  const c0 = hLo * m;
  const c1 = h1 + hHi * m;
  const c2 = (c1 < h1 ? <u64>1 : 0) + mulhi64(hHi, m);

  let rhi: u64, rlo: u64;
  if (c2 >> 63 != 0) {
    rhi = c2;
    rlo = c1;
  } else {
    rhi = (c2 << 1) | (c1 >> 63);
    rlo = (c1 << 1) | (c0 >> 63);
  }
  rlo -= (POW10_FIXUPS[i >> 5] >> (i & 31)) & 1;
  store<u64>(POW10_TABLE + (i << 4), rhi);
  store<u64>(POW10_TABLE + (i << 4) + 8, rlo);
}

// Hot-path lookup: 10**(-(negIndex + 293)) significand. dec_exp_min = -293.
// @ts-ignore: inline
@inline function loadPow10(negIndex: i32): void {
  const off = POW10_TABLE + ((negIndex + 293) << 4);
  gPow10Hi = load<u64>(off);
  gPow10Lo = load<u64>(off, 8);
}

// ---------------------------------------------------------------------------
// BCD digit extraction (Xiang JunBo's three-step base conversion)
// ---------------------------------------------------------------------------

const DIV10K_EXP = 40;
const DIV10K_SIG: u64 = ((<u64>1) << DIV10K_EXP) / 10000 + 1;
const NEG10K: u64 = ((<u64>1) << 32) - 10000;

const DIV100_EXP = 19;
const DIV100_SIG: u64 = (1 << DIV100_EXP) / 100 + 1;
const NEG100: u64 = (1 << 16) - 100;

const DIV10_EXP = 10;
const DIV10_SIG: u64 = (1 << DIV10_EXP) / 10 + 1;
const NEG10: u64 = (1 << 8) - 10;

const ZEROS: u64 = 0x3030303030303030; // 0x01010101_01010101 * '0'

// to_bcd8 result.
let gBcd: u64 = 0;
let gBcdLen: i32 = 0;

// Converts a value < 1e8 to 8 packed BCD digits ('a' in the low byte). This is
// the SWAR (SIMD-within-a-register) kernel: it extracts all 8 digits in
// parallel inside one u64 via the base-10000 -> 100 -> 10 multiply trick, with
// the lane masks (0x7f0000007f, 0xf000f000f000f) isolating each group's bits.
function toBcd8(abcdefgh: u64): void {
  // base 10000 -> two 4-digit groups, one per 32-bit half.
  const abcd_efgh = abcdefgh + NEG10K * ((abcdefgh * DIV10K_SIG) >> DIV10K_EXP);
  // each 4-digit group -> two 2-digit groups, one per 16-bit lane.
  const ab_cd_ef_gh =
    abcd_efgh +
    NEG100 * (((abcd_efgh * DIV100_SIG) >> DIV100_EXP) & 0x7f0000007f);
  // each 2-digit group -> two single digits, one per byte.
  const a_b_c_d_e_f_g_h =
    ab_cd_ef_gh +
    NEG10 * (((ab_cd_ef_gh * DIV10_SIG) >> DIV10_EXP) & 0xf000f000f000f);
  const bcd = bswap64(a_b_c_d_e_f_g_h);
  gBcd = bcd;
  gBcdLen = countTrailingNonzeros(bcd);
}

// to_digits<64> result: two u64 of ASCII digits + significant digit count.
let gDigHi: u64 = 0;
let gDigLo: u64 = 0;
let gDigNum: i32 = 0;

// --- WASM SIMD digit extraction (port of the SSE4.1 to_bcd_4x4 path) --------

// Unsigned 16-bit multiply-high across all 8 lanes (= _mm_mulhi_epu16).
// @ts-ignore: decorator
@inline
function mulhiU16(a: v128, b: v128): v128 {
  const lo = i32x4.shr_u(i32x4.extmul_low_i16x8_u(a, b), 16);
  const hi = i32x4.shr_u(i32x4.extmul_high_i16x8_u(a, b), 16);
  return i16x8.narrow_i32x4_u(lo, hi);
}

// Converts four 4-digit values (one per i32 lane) into 16 BCD bytes, where
// byte i holds the 10**i digit (little-endian digit order). Mirrors the
// SSE4.1 to_bcd_4x4: V -> (V%100 | (V/100)<<16) -> per-byte ones/tens split.
// @ts-ignore: decorator
@inline
function toBcd4x4(y: v128): v128 {
  const div100 = i32x4.splat(<i32>DIV100_SIG); // 5243
  const div10v = i16x8.splat(6554); // (1<<16)/10 + 1
  const neg100v = i32x4.splat(65436); // (1<<16) - 100
  const neg10v = i16x8.splat(246); // (1<<8) - 10
  const t = i32x4.shr_u(mulhiU16(y, div100), 3);
  const z = i32x4.add(y, i32x4.mul(neg100v, t));
  return i16x8.add(z, i16x8.mul(neg10v, mulhiU16(z, div10v)));
}

// Swizzle mask: pull the low 32 bits of each i64 lane into adjacent i32 lanes
// 0,1 and zero the rest (-128 = high bit set -> output 0). Lets a single-input
// v128.swizzle stand in for the two-input shuffle with a separate zero vector.
// @ts-ignore: decorator
@inline function packLo32(v: v128): v128 {
  return v128.swizzle(
    v,
    i8x16(
      0,
      1,
      2,
      3,
      8,
      9,
      10,
      11,
      -128,
      -128,
      -128,
      -128,
      -128,
      -128,
      -128,
      -128,
    ),
  );
}

// SIMD version of toDigits64: builds all 16 ASCII digits in one pass.
function toDigits64Simd(value: u64): void {
  const hi = value / 100000000;
  const lo = value % 100000000;

  // 64-bit lanes: lane0 = lo, lane1 = hi.
  const x = i64x2.replace_lane(i64x2.splat(lo), 1, hi);

  // Split each 8-digit group into two 4-digit halves across the i32 lanes:
  //   y.i32 = [lo%1e4, lo/1e4, hi%1e4, hi/1e4]
  // Pack the low 32 bits of each 64-bit lane into adjacent i32 lanes for the
  // unsigned 32->64 extmul (WASM extmul_low takes lanes 0,1, not 0,2).
  const q = i64x2.shr_u(
    i64x2.extmul_low_i32x4_u(packLo32(x), i32x4.splat(<i32>DIV10K_SIG)),
    DIV10K_EXP,
  );
  // (group/1e4) * (2^32 - 1e4); adding to x leaves group%1e4 low, group/1e4 high.
  const sub = i64x2.extmul_low_i32x4_u(packLo32(q), i32x4.splat(-10000));
  const y = i64x2.add(x, sub);

  const bcd = toBcd4x4(y);

  // Significant digit count: bit i of the mask = (10**i digit nonzero).
  const mask = i8x16.bitmask(i8x16.gt_s(bcd, i8x16.splat(0)));
  gDigNum = mask != 0 ? 16 - ctz(mask) : 0;

  // Reverse to printing order (MSD first) and add '0' to each digit.
  const ascii = v128.or(
    v128.swizzle(
      bcd,
      i8x16(15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
    ),
    i8x16.splat(0x30),
  );
  gDigHi = i64x2.extract_lane(ascii, 0);
  gDigLo = i64x2.extract_lane(ascii, 1);
}

// SWAR version of toDigits64: two register-parallel to_bcd8 passes over u64,
// 8 digits each. No v128 — works on any WebAssembly runtime.
function toDigits64Swar(value: u64): void {
  const hi = value / 100000000;
  const lo = value % 100000000;
  toBcd8(hi);
  const hiBcd = gBcd,
    hiLen = gBcdLen;
  if (lo == 0) {
    gDigHi = hiBcd + ZEROS;
    gDigLo = ZEROS;
    gDigNum = hiLen;
    return;
  }
  toBcd8(lo);
  gDigHi = hiBcd + ZEROS;
  gDigLo = gBcd + ZEROS;
  gDigNum = 8 + gBcdLen;
}

// Backend selector. When SIMD is compiled in, the v128 path is the default;
// `forceSwarBackend(true)` pins the SWAR path (used by the benchmark to compare
// the two in a single binary). No effect on builds without SIMD.
let gForceSwar: bool = false;
export function forceSwarBackend(force: bool): void {
  gForceSwar = force;
}

// Converts a significand (up to 17 decimal digits) to ASCII digits, dropping
// trailing zeros from the count. Dispatches to the best available backend.
function toDigits64(value: u64): void {
  if (ASC_FEATURE_SIMD && !gForceSwar) {
    toDigits64Simd(value);
    return;
  }
  toDigits64Swar(value);
}

// SIMD to_digits<32>: 8 ASCII digits in a u64 (value < 1e8).
function toDigits32Simd(value: u64): void {
  const abcd_efgh = value + NEG10K * ((value * DIV10K_SIG) >> DIV10K_EXP);
  // lane0 = abcd_efgh (two 4-digit groups in its 32-bit halves), lane1 = 0.
  const x = i64x2.replace_lane(i64x2.splat(abcd_efgh), 1, 0);
  const bcd = toBcd4x4(x); // bytes 0-7 = 10**0..10**7 digits, 8-15 = 0
  const low = i64x2.extract_lane(bcd, 0);
  gDigHi = bswap64(low) + ZEROS; // printing order ASCII
  gDigNum = low != 0 ? 8 - <i32>(ctz(low) >> 3) : 0;
}

// to_digits<32>: a single u64 of 8 ASCII digits (value < 1e8).
function toDigits32(value: u64): void {
  if (ASC_FEATURE_SIMD && !gForceSwar) {
    toDigits32Simd(value);
    return;
  }
  toBcd8(value);
  gDigHi = gBcd + ZEROS;
  gDigNum = gBcdLen;
}

// ---------------------------------------------------------------------------
// Core: binary -> shortest decimal
// ---------------------------------------------------------------------------

// to_decimal_result, written into globals.
let gSig: i64 = 0;
let gExp: i32 = 0;
let gLastDigit: i32 = 0;
let gHasLastDigit: bool = false;

const DOUBLE_EXP_OFFSET = 1075; // exp_bias(1023) + num_sig_bits(52)
const EXTRA_SHIFT = 6;
const BIASED_HALF: u64 = ((<u64>1) << 63) + 6;

// Generic irregular (power-of-two boundary) path, shared by float and double.
// Uses the full 128-bit significand and extra_shift = 6.
function decodeIrregular(binSig: u64, binExp: i32): void {
  const decExp = computeDecExp(binExp, false);
  const shift = computeExpShift(binExp, decExp + 1) + EXTRA_SHIFT;
  loadPow10(-decExp - 1);
  const pHi = gPow10Hi,
    pLo = gPow10Lo;
  const y = binSig << shift;

  const a = mulhi64(pHi, y);
  const plo64 = pHi * y;
  const lo = plo64 + mulhi64(pLo, y);
  const p_hi = a + (lo < plo64 ? <u64>1 : 0);
  const p_lo = lo;

  let integral = <i64>(p_hi >> EXTRA_SHIFT);
  const fractional = (p_hi << (64 - EXTRA_SHIFT)) | (p_lo >> EXTRA_SHIFT);

  const half_ulp = pHi >> (EXTRA_SHIFT + 1 - shift);
  const round_up = half_ulp > ~(<u64>0) - fractional;
  const round_down = half_ulp >> 1 > fractional;
  integral += round_up ? 1 : 0;

  let digit = <i32>umul128AddHi64(fractional, 10, ((<u64>1) << 63) - 1);
  const lo2 = <i32>umul128AddHi64(fractional - (half_ulp >> 1), 10, ~(<u64>0));
  if (digit < lo2) digit = lo2;

  gSig = integral;
  gExp = decExp;
  gLastDigit = digit;
  gHasLastDigit = !(round_up || round_down);
}

// Converts bin_sig * 2**(raw_exp - exp_offset) to the shortest decimal.
function toDecimalDouble(binSig: u64, rawExp: i64, regular: bool): void {
  const binExp = <i32>(rawExp - DOUBLE_EXP_OFFSET);

  if (!regular) {
    decodeIrregular(binSig, binExp);
    return;
  }

  const decExp = computeDecExp(binExp);
  const shift = computeExpShift(binExp, decExp + 1) + EXTRA_SHIFT;
  const even = <u64>(1 - (binSig & 1));

  loadPow10(-decExp - 1);
  const pHi = gPow10Hi,
    pLo = gPow10Lo;
  const y = binSig << shift;

  const a = mulhi64(pHi, y);
  const plo64 = pHi * y;
  const lo = plo64 + mulhi64(pLo, y);
  const p_hi = a + (lo < plo64 ? <u64>1 : 0);
  const p_lo = lo;

  let integral = <i64>(p_hi >> EXTRA_SHIFT);
  const fractional = (p_hi << (64 - EXTRA_SHIFT)) | (p_lo >> EXTRA_SHIFT);

  const half_ulp = (pHi >> (EXTRA_SHIFT + 1 - shift)) + even;
  const round_up = fractional + half_ulp < fractional;
  const round_down = half_ulp > fractional;
  integral += round_up ? 1 : 0;

  let digit = <i32>umul128AddHi64(fractional, 10, BIASED_HALF);
  if (fractional == (<u64>1) << 62) digit = 2;

  gSig = integral;
  gExp = decExp;
  gLastDigit = digit;
  gHasLastDigit = !(round_up || round_down);
}

const FLOAT_EXP_OFFSET = 150; // exp_bias(127) + num_sig_bits(23)
const FLOAT_EXTRA_SHIFT = 34;

// Float (32-bit) version. The irregular path is shared with double.
function toDecimalFloat(binSig: u64, rawExp: i64, regular: bool): void {
  const binExp = <i32>(rawExp - FLOAT_EXP_OFFSET);

  if (!regular) {
    decodeIrregular(binSig, binExp);
    return;
  }

  const decExp = computeDecExp(binExp);
  const shift = computeExpShift(binExp, decExp + 1) + FLOAT_EXTRA_SHIFT;
  const even = <u64>(1 - (binSig & 1));

  loadPow10(-decExp - 1);
  const pow10Hi = gPow10Hi;
  const p = mulhi64(pow10Hi + 1, binSig << shift);

  let integral = <i64>(p >> FLOAT_EXTRA_SHIFT);
  const fractional = p & (((<u64>1) << FLOAT_EXTRA_SHIFT) - 1);

  const half_ulp = (pow10Hi >> (65 - shift)) + even;
  const round_up = (fractional + half_ulp) >> FLOAT_EXTRA_SHIFT != 0;
  const round_down = half_ulp > fractional;
  integral += round_up ? 1 : 0;

  let digit = <i32>(
    ((fractional * 10 + ((<u64>1) << (FLOAT_EXTRA_SHIFT - 1))) >>
      FLOAT_EXTRA_SHIFT)
  );
  if (fractional == (<u64>1) << (FLOAT_EXTRA_SHIFT - 2)) digit = 2; // round 2.5 to 2

  gSig = integral;
  gExp = decExp;
  gLastDigit = digit;
  gHasLastDigit = !(round_up || round_down);
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

const DOUBLE_MAX_DIGITS10 = 17;
// ECMAScript Number::toString uses fixed notation when the decimal point
// position n is in [-5, 21]; with decExp = n - 1 that is decExp in [-6, 20].
// (json-as targets `JSON.stringify(JSON.parse(x))`, i.e. Number::toString.)
const MIN_FIXED_DEC_EXP = -6;
const DOUBLE_MAX_FIXED_DEC_EXP = 20;

const FLOAT_MAX_DIGITS10 = 9;
const FLOAT_MAX_FIXED_DEC_EXP = 20;

// @ts-ignore: decorator
// json-as serializes into a UTF-16 buffer (AS strings are UTF-16), so the
// writers below emit one u16 per character. zmij still builds its shortest
// decimal digits as packed ASCII *bytes* in registers; `storeAscii8` widens an
// 8-byte block (low byte = first char) to eight u16 as it lands in the output.
// All `buf` values and offsets are byte addresses — one character is 2 bytes.
// @ts-ignore: inline
@inline function storeAscii8(dst: usize, packed: u64): void {
  if (ASC_FEATURE_SIMD) {
    const b = i64x2.replace_lane(i8x16.splat(0), 0, packed);
    v128.store(dst, i16x8.extend_low_i8x16_u(b));
  } else {
    store<u16>(dst, <u16>(packed & 0xff));
    store<u16>(dst + 2, <u16>((packed >> 8) & 0xff));
    store<u16>(dst + 4, <u16>((packed >> 16) & 0xff));
    store<u16>(dst + 6, <u16>((packed >> 24) & 0xff));
    store<u16>(dst + 8, <u16>((packed >> 32) & 0xff));
    store<u16>(dst + 10, <u16>((packed >> 40) & 0xff));
    store<u16>(dst + 12, <u16>((packed >> 48) & 0xff));
    store<u16>(dst + 14, <u16>((packed >> 56) & 0xff));
  }
}

// Widen a full 16-byte BCD block (hi = chars 0-7, lo = chars 8-15) to UTF-16.
// One v128 carries both halves, so SIMD splits it with a single extend pair
// instead of rebuilding a vector per 8-byte group.
// @ts-ignore: inline
@inline function storeAscii16(dst: usize, hi: u64, lo: u64): void {
  if (ASC_FEATURE_SIMD) {
    const b = i64x2.replace_lane(i64x2.splat(hi), 1, lo);
    v128.store(dst, i16x8.extend_low_i8x16_u(b));
    v128.store(dst + 16, i16x8.extend_high_i8x16_u(b));
  } else {
    storeAscii8(dst, hi);
    storeAscii8(dst + 16, lo);
  }
}


@inline
function writeDigits2(buf: usize, value: i32): void {
  store<u16>(buf, <u16>(0x30 + value / 10));
  store<u16>(buf + 2, <u16>(0x30 + (value % 10)));
}

// ECMAScript spellings for the non-finite cases.
// @ts-ignore: inline
@inline function writeNaN(buf: usize): usize {
  store<u16>(buf, 0x4e); // 'N'
  store<u16>(buf + 2, 0x61); // 'a'
  store<u16>(buf + 4, 0x4e); // 'N'
  return buf + 6;
}
// @ts-ignore: inline
@inline function writeInfinity(buf: usize, neg: bool): usize {
  if (neg) {
    store<u16>(buf, 0x2d); // '-'
    buf += 2;
  }
  store<u16>(buf, 0x49); // 'I'
  store<u16>(buf + 2, 0x6e); // 'n'
  store<u16>(buf + 4, 0x66); // 'f'
  store<u16>(buf + 6, 0x69); // 'i'
  store<u16>(buf + 8, 0x6e); // 'n'
  store<u16>(buf + 10, 0x69); // 'i'
  store<u16>(buf + 12, 0x74); // 't'
  store<u16>(buf + 14, 0x79); // 'y'
  return buf + 16;
}

// Writes the shortest decimal representation of `value` (double) starting at
// `buf`, returning a pointer past the last char written (2 bytes per char).
// `buf` must have at least 64 bytes of capacity.
export function writeDoubleUnsafe(buf: usize, value: f64): usize {
  const bits = reinterpret<u64>(value);
  const binExp = <i64>((bits << 1) >> 53); // 11 exponent bits
  const binSig = bits & (((<u64>1) << 52) - 1); // 52 significand bits

  const neg = bits >> 63 != 0;
  const threshold: u64 = 1000000000000000; // 1e15
  const expMask = 2047;

  // is_normal: 1 <= bin_exp <= 2046
  const isNormal = <u64>(binExp - 1) < <u64>(expMask - 1);
  if (!isNormal) {
    if (binExp != 0) {
      // ECMAScript: NaN renders "NaN" (no sign); -Infinity keeps its sign.
      if (binSig != 0) return writeNaN(buf);
      return writeInfinity(buf, neg);
    }
    if (binSig == 0) {
      store<u16>(buf, 0x30); // +/-0 -> "0"
      return buf + 2;
    }
    // subnormal
    if (neg) {
      store<u16>(buf, 0x2d);
      buf += 2;
    }
    toDecimalDouble(binSig, 1, true);
    let decSig = gSig * 10 + (gHasLastDigit ? gLastDigit : 0);
    let decExp = gExp;
    while (<u64>decSig < threshold) {
      decSig *= 10;
      --decExp;
    }
    const q = <i64>div10(<u64>decSig);
    const last = <i32>(decSig - q * 10);
    gSig = q;
    gExp = decExp;
    gLastDigit = last;
    gHasLastDigit = last != 0;
  } else {
    if (neg) {
      store<u16>(buf, 0x2d);
      buf += 2;
    }
    toDecimalDouble(binSig | ((<u64>1) << 52), binExp, binSig != 0);
  }

  let hasLastDigit = gHasLastDigit;
  const hasExtraDigit = <u64>gSig >= threshold;
  let decExp = gExp + DOUBLE_MAX_DIGITS10 - 2 + (hasExtraDigit ? 1 : 0);

  const start = buf;
  toDigits64(<u64>gSig);
  const bcdSize = 16;

  if (decExp >= MIN_FIXED_DEC_EXP && decExp <= DOUBLE_MAX_FIXED_DEC_EXP) {
    return writeFixed(
      buf,
      start,
      decExp,
      hasLastDigit,
      hasExtraDigit,
      bcdSize,
      DOUBLE_MAX_DIGITS10,
    );
  }

  // Exponential notation.
  buf += hasExtraDigit ? 2 : 0;
  storeAscii16(buf, gDigHi, gDigLo);
  store<u16>(buf + (bcdSize << 1), <u16>(0x30 + gLastDigit));
  buf += (hasLastDigit ? bcdSize + 1 : gDigNum) << 1;
  store<u16>(start, load<u16>(start + 2));
  store<u16>(start + 2, 0x2e); // '.'
  buf -= buf - 2 == start + 2 ? 2 : 0; // remove trailing point

  return writeExponent(buf, decExp);
}

// Writes the shortest decimal representation of `value` (float) starting at
// `buf` as UTF-16, returning a pointer past the last char. `buf` must have at
// least 32 bytes of capacity.
export function writeFloatUnsafe(buf: usize, value: f32): usize {
  const bits = reinterpret<u32>(value);
  const binExp = <i64>((bits << 1) >> 24); // 8 exponent bits
  const binSig = <u64>(bits & (((<u32>1) << 23) - 1)); // 23 significand bits

  const neg = bits >> 31 != 0;
  const threshold: u64 = 10000000; // 1e7
  const expMask = 255;

  const isNormal = <u64>(binExp - 1) < <u64>(expMask - 1);
  if (!isNormal) {
    if (binExp != 0) {
      // ECMAScript: NaN renders "NaN" (no sign); -Infinity keeps its sign.
      if (binSig != 0) return writeNaN(buf);
      return writeInfinity(buf, neg);
    }
    if (binSig == 0) {
      store<u16>(buf, 0x30); // +/-0 -> "0"
      return buf + 2;
    }
    // subnormal
    if (neg) {
      store<u16>(buf, 0x2d);
      buf += 2;
    }
    toDecimalFloat(binSig, 1, true);
    let decSig = gSig * 10 + (gHasLastDigit ? gLastDigit : 0);
    let decExp = gExp;
    while (<u64>decSig < threshold) {
      decSig *= 10;
      --decExp;
    }
    const q = <i64>div10(<u64>decSig);
    const last = <i32>(decSig - q * 10);
    gSig = q;
    gExp = decExp;
    gLastDigit = last;
    gHasLastDigit = last != 0;
  } else {
    if (neg) {
      store<u16>(buf, 0x2d);
      buf += 2;
    }
    toDecimalFloat(binSig | ((<u64>1) << 23), binExp, binSig != 0);
  }

  let hasLastDigit = gHasLastDigit;
  const hasExtraDigit = <u64>gSig >= threshold;
  let decExp = gExp + FLOAT_MAX_DIGITS10 - 2 + (hasExtraDigit ? 1 : 0);

  // Float-specific fixup: pull a digit up when the significand is too short.
  if (<u64>gSig < 1000000) {
    gSig = 10 * gSig + (hasLastDigit ? gLastDigit : 0);
    hasLastDigit = false;
    --decExp;
  }

  const start = buf;
  toDigits32(<u64>gSig);
  const bcdSize = 8;

  if (decExp >= MIN_FIXED_DEC_EXP && decExp <= FLOAT_MAX_FIXED_DEC_EXP) {
    return writeFixed(
      buf,
      start,
      decExp,
      hasLastDigit,
      hasExtraDigit,
      bcdSize,
      FLOAT_MAX_DIGITS10,
    );
  }

  // Exponential notation. (The fully-SIMD single-shuffle path is not used: its
  // fixed-width "e±NN" exponent can't express ECMAScript's minimal-width form.)
  buf += hasExtraDigit ? 2 : 0;
  storeAscii8(buf, gDigHi);
  store<u16>(buf + (bcdSize << 1), <u16>(0x30 + gLastDigit));
  buf += (hasLastDigit ? bcdSize + 1 : gDigNum) << 1;
  store<u16>(start, load<u16>(start + 2));
  store<u16>(start + 2, 0x2e); // '.'
  buf -= buf - 2 == start + 2 ? 2 : 0;

  return writeExponent(buf, decExp);
}

// Shared fixed-notation writer for both double and float.
function writeFixed(
  buf: usize,
  start: usize,
  decExp: i32,
  hasLastDigit: bool,
  hasExtraDigit: bool,
  bcdSize: i32,
  maxDigits10: i32,
): usize {
  // Leading "0.0000…" prefix is only needed when the point precedes the digits
  // (decExp < 0). For every value >= 1 these zeros are immediately overwritten
  // by the digit block, so skip the store on the common path.
  if (decExp < 0) storeAscii8(start, ZEROS);
  const lastDigitChar = <u16>(0x30 + (hasLastDigit ? gLastDigit : 0));
  const numDigits = hasLastDigit ? bcdSize : gDigNum - 1;

  // ECMAScript step 6.a: when the decimal point falls at or past the last
  // significant digit (decExp + 1 >= digits, i.e. decExp >= bcdSize), the value
  // is an integer rendered as the significant digits followed by trailing zeros
  // with *no* decimal point. The generic point-insertion path below only covers
  // up to one BCD block, so handle the wider integer case here.
  if (decExp >= bcdSize) {
    if (bcdSize == 16) storeAscii16(buf, gDigHi, gDigLo);
    else storeAscii8(buf, gDigHi);
    if (!hasExtraDigit) memory.copy(buf, buf + 2, bcdSize << 1);
    store<u16>(
      buf + ((bcdSize + (hasExtraDigit ? 1 : 0) - 1) << 1),
      lastDigitChar,
    );
    // Significant digits placed = bcdSize (+1 with the extra digit); pad with
    // '0' out to decExp + 1 total digits. Positions in [sig, bcdSize) are
    // already '0' from the BCD block, so this only extends past the block.
    const sig = bcdSize + (hasExtraDigit ? 1 : 0);
    const endByte = buf + ((decExp + 1) << 1);
    for (let z = buf + (sig << 1); z < endByte; z += 2) store<u16>(z, 0x30);
    return endByte;
  }

  // fixed_layout entry, computed on the fly (positions are in characters).
  const startPos = decExp < 0 ? 1 - decExp : 0;
  const pointPos = decExp >= 0 ? 1 + decExp : 1;
  const shiftPos = pointPos + (decExp >= 0 ? 1 : 0);

  buf += startPos << 1;
  // write_digits: store BCD, optionally dropping the leading '0'.
  if (bcdSize == 16) storeAscii16(buf, gDigHi, gDigLo);
  else storeAscii8(buf, gDigHi);
  if (!hasExtraDigit) memory.copy(buf, buf + 2, bcdSize << 1);
  store<u16>(
    buf + ((bcdSize + (hasExtraDigit ? 1 : 0) - 1) << 1),
    lastDigitChar,
  );

  memory.copy(start + (shiftPos << 1), start + (pointPos << 1), bcdSize << 1);
  store<u16>(start + (pointPos << 1), 0x2e); // '.'

  // end_pos[num_digits + has_extra_digit - 1]
  const n = numDigits + (hasExtraDigit ? 1 : 0);
  let endPos = n;
  if (decExp >= 0) endPos = n > decExp + 1 ? n + 1 : decExp + 1;
  return buf + (endPos << 1);
}

// Writes "e±d" / "e±dd" / "e±ddd" exponent. ECMAScript Number::toString writes
// the exponent magnitude with no leading zeros, so the width is minimal.
function writeExponent(buf: usize, decExp: i32): usize {
  store<u16>(buf, 0x65); // 'e'
  store<u16>(buf + 2, decExp >= 0 ? 0x2b : 0x2d); // '+' / '-'
  buf += 4;
  let e = decExp >= 0 ? decExp : -decExp;
  if (e >= 100) {
    const d = (<u32>e * <u32>DIV100_SIG) >> DIV100_EXP; // e / 100
    store<u16>(buf, <u16>(0x30 + d));
    writeDigits2(buf + 2, e - <i32>d * 100);
    return buf + 6;
  }
  if (e >= 10) {
    writeDigits2(buf, e);
    return buf + 4;
  }
  store<u16>(buf, <u16>(0x30 + e));
  return buf + 2;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Scratch buffer for string-returning helpers. UTF-16 output plus SIMD store
// overshoot (storeAscii8 writes 16 bytes, the exp writer 32) needs headroom
// beyond the ~26-char max, so 128 bytes.
const SCRATCH = memory.data(128);

export function dtoa(value: f64): string {
  const end = writeDoubleUnsafe(SCRATCH, value);
  const len = <i32>(end - SCRATCH);
  return String.UTF16.decodeUnsafe(SCRATCH, len);
}

export function ftoa(value: f32): string {
  const end = writeFloatUnsafe(SCRATCH, value);
  const len = <i32>(end - SCRATCH);
  return String.UTF16.decodeUnsafe(SCRATCH, len);
}

// {sig, exp, negative} decomposition.
export class DecFP {
  sig: i64 = 0;
  exp: i32 = 0;
  negative: bool = false;
}

const NON_FINITE_EXP: i32 = 0x7fffffff;

export function toDecimal(value: f64): DecFP {
  const bits = reinterpret<u64>(value);
  let binExp = <i64>((bits << 1) >> 53);
  let binSig = bits & (((<u64>1) << 52) - 1);
  const negative = bits >> 63 != 0;
  const result = new DecFP();
  result.negative = negative;

  if (binExp == 0 || binExp == 2047) {
    if (binExp != 0) {
      result.sig = <i64>binSig;
      result.exp = NON_FINITE_EXP;
      return result;
    }
    if (binSig == 0) {
      result.sig = 0;
      result.exp = 0;
      return result;
    }
    binExp = 1;
    binSig |= (<u64>1) << 52;
  }
  toDecimalDouble(binSig ^ ((<u64>1) << 52), binExp, binSig != 0);
  const lastDigit = gHasLastDigit ? gLastDigit : 0;
  result.sig = gSig * 10 + lastDigit;
  result.exp = gExp;
  return result;
}
