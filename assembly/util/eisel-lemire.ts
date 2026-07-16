// Fast, correctly-rounded conversion of `mantissa * 10^power` for the common
// decimal-exponent range [-22, 22]. This is the Eisel-Lemire conversion used by
// simdjson's number parser, specialized to the range where json-as previously
// fell into `scientific()` after the exact-Clinger path rejected mantissas above
// 2^53. Keeping only 45 cached powers costs 720 bytes instead of simdjson's
// general 10 KiB table; callers retain `scientific()` as the wide-range fallback.

// Consecutive {primary, secondary} truncated 128-bit powers of five for decimal
// exponents -22 through 22. Sourced from simdjson's power_of_five_128 table.
const POWERS_OF_FIVE_128: usize = memory.data<u64>([
  0xf1c90080baf72cb1, 0x5324c68b12dd6800, 0x971da05074da7bee,
  0xd3f6fc16ebca8000, 0xbce5086492111aea, 0x88f4bb1ca6bd0000,
  0xec1e4a7db69561a5, 0x2b31e9e3d0700000, 0x9392ee8e921d5d07,
  0x3aff322e62600000, 0xb877aa3236a4b449, 0x09befeb9fad487c3,
  0xe69594bec44de15b, 0x4c2ebe687989a9b4, 0x901d7cf73ab0acd9,
  0x0f9d37014bf60a11, 0xb424dc35095cd80f, 0x538484c19ef38c95,
  0xe12e13424bb40e13, 0x2865a5f206b06fba, 0x8cbccc096f5088cb,
  0xf93f87b7442e45d4, 0xafebff0bcb24aafe, 0xf78f69a51539d749,
  0xdbe6fecebdedd5be, 0xb573440e5a884d1c, 0x89705f4136b4a597,
  0x31680a88f8953031, 0xabcc77118461cefc, 0xfdc20d2b36ba7c3e,
  0xd6bf94d5e57a42bc, 0x3d32907604691b4d, 0x8637bd05af6c69b5,
  0xa63f9a49c2c1b110, 0xa7c5ac471b478423, 0x0fcf80dc33721d54,
  0xd1b71758e219652b, 0xd3c36113404ea4a9, 0x83126e978d4fdf3b,
  0x645a1cac083126ea, 0xa3d70a3d70a3d70a, 0x3d70a3d70a3d70a4,
  0xcccccccccccccccc, 0xcccccccccccccccd, 0x8000000000000000,
  0x0000000000000000, 0xa000000000000000, 0x0000000000000000,
  0xc800000000000000, 0x0000000000000000, 0xfa00000000000000,
  0x0000000000000000, 0x9c40000000000000, 0x0000000000000000,
  0xc350000000000000, 0x0000000000000000, 0xf424000000000000,
  0x0000000000000000, 0x9896800000000000, 0x0000000000000000,
  0xbebc200000000000, 0x0000000000000000, 0xee6b280000000000,
  0x0000000000000000, 0x9502f90000000000, 0x0000000000000000,
  0xba43b74000000000, 0x0000000000000000, 0xe8d4a51000000000,
  0x0000000000000000, 0x9184e72a00000000, 0x0000000000000000,
  0xb5e620f480000000, 0x0000000000000000, 0xe35fa931a0000000,
  0x0000000000000000, 0x8e1bc9bf04000000, 0x0000000000000000,
  0xb1a2bc2ec5000000, 0x0000000000000000, 0xde0b6b3a76400000,
  0x0000000000000000, 0x8ac7230489e80000, 0x0000000000000000,
  0xad78ebc5ac620000, 0x0000000000000000, 0xd8d726b7177a8000,
  0x0000000000000000, 0x878678326eac9000, 0x0000000000000000,
]);

// High half of a full 64x64 -> 128 multiplication, using four 32-bit partial
// products. WebAssembly MVP has no i128 or mul-high instruction.
function mul64High(a: u64, b: u64): u64 {
  const aLo = <u64>(<u32>a);
  const aHi = a >> 32;
  const bLo = <u64>(<u32>b);
  const bHi = b >> 32;
  const lowLow = aLo * bLo;
  const highLow = aHi * bLo;
  const middle = highLow + aLo * bHi;
  const middleCarry = <u64>(middle < highLow);
  const low = lowLow + (middle << 32);
  return aHi * bHi + (middle >> 32) + (middleCarry << 32) + <u64>(low < lowLow);
}

/**
 * Convert a non-zero u64 significand at a decimal exponent in [-22, 22].
 * The result is correctly rounded to IEEE-754 binary64.
 */
export function eiselLemire22(significand: u64, power: i32): f64 {
  let i = significand;
  let leading = <i32>clz(i);
  i <<= leading;

  const tableIndex = (<usize>(power + 22)) << 4;
  const factor = load<u64>(POWERS_OF_FIVE_128 + tableIndex);
  let lower = i * factor;
  let upper = mul64High(i, factor);

  // A primary product ending in nine uncertain bits needs the second table
  // limb. This is rare, but removes Eisel-Lemire's historical fallback.
  if ((upper & 0x1ff) == 0x1ff) {
    const secondUpper = mul64High(
      i,
      load<u64>(POWERS_OF_FIVE_128 + tableIndex, 8),
    );
    const oldLower = lower;
    lower += secondUpper;
    if (lower < oldLower) upper++;
  }

  const upperBit = upper >> 63;
  let mantissa = upper >> (<i32>(upperBit + 9));
  leading += <i32>(1 ^ upperBit);
  let realExponent = <i32>(((<i64>217706 * power) >> 16) + 1087) - leading;
  const halfwayShift = <i32>(upperBit + 9);

  // Round exact halfway cases to even.
  if (
    lower <= 1 &&
    power >= -4 &&
    power <= 22 &&
    (mantissa & 3) == 1 &&
    mantissa << halfwayShift == upper
  ) {
    mantissa &= ~(<u64>1);
  }
  mantissa += mantissa & 1;
  mantissa >>= 1;

  if (mantissa >= (<u64>1) << 53) {
    mantissa = (<u64>1) << 52;
    realExponent++;
  }

  const bits = (mantissa & ~((<u64>1) << 52)) | ((<u64>realExponent) << 52);
  return reinterpret<f64>(bits);
}
