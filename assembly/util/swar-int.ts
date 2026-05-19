// 4-digit lane masks
const LANE_LO_4: u64 = 0x00ff_00ff_00ff_00ff;
const ZERO_4: u64 = 0x0030_0030_0030_0030;
const RANGE_ADD_4: u64 = 0x0006_0006_0006_0006;
const RANGE_MASK_4: u64 = 0xfff0_fff0_fff0_fff0;

// 32-bit-pair masks used by the pair-multiply fold
const U32_LO_PAIR: u64 = 0x0000_ffff_0000_ffff;

/**
 * Magic multiplier for the 4-digit final combine.
 *
 * With `pairs = (cd << 32) | ab` where `ab` and `cd` are two-digit fold
 * results each in `[0, 99]`, multiplying by this constant places
 * `ab*100 + cd` in the high 32 bits via the u64 multiplication's cross-term.
 * Taking the high 32 yields the 4-digit value `1000a + 100b + 10c + d`.
 */
const FINAL_4_MAGIC: u64 = 0x0000_0064_0000_0001;

/**
 * Parse four UTF-16 ASCII digits in a `u64` into the 4-digit value, using
 * the baseline scalar combine. Kept for reference and head-to-head benches.
 *
 * Returns `U32.MAX_VALUE` on any non-digit lane.
 *
 * @param block Four UTF-16 code units packed into a `u64`.
 * @returns The parsed 4-digit value, or `U32.MAX_VALUE` on invalid input.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function parse4Digits_Baseline(block: u64): u32 {
  const digits = (block & LANE_LO_4) - ZERO_4;
  if (((digits | (digits + RANGE_ADD_4)) & RANGE_MASK_4) != 0) {
    return U32.MAX_VALUE;
  }
  return <u32>(
    (<u32>(digits & 0xffff) * 1000 +
      <u32>((digits >> 16) & 0xffff) * 100 +
      <u32>((digits >> 32) & 0xffff) * 10 +
      <u32>(digits >> 48))
  );
}

/**
 * Parse four UTF-16 ASCII digits into the 4-digit value.
 *
 * Three Lemire-inspired op reductions vs the baseline:
 *
 * 1. Skip the initial `& LANE_LO_4` mask. For valid UTF-16 ASCII the high
 *    byte of each lane is already 0, so the AND is redundant. Validation
 *    runs before any multiply and rejects every input where dropping the
 *    AND would produce inter-lane carry corruption.
 * 2. Mul-then-mask pair fold: apply `digits * 10 + (digits >> 16)` to the
 *    whole `u64` and mask after. Saves one AND vs the lane-isolated form.
 * 3. Magic-multiplier final combine: see {@link FINAL_4_MAGIC}.
 *
 * Returns `U32.MAX_VALUE` on any non-digit lane.
 *
 * @param block Four UTF-16 code units packed into a `u64`.
 * @returns The parsed 4-digit value, or `U32.MAX_VALUE` on invalid input.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function parse4Digits_PairMul(block: u64): u32 {
  const digits = block - ZERO_4;
  if (((digits | (digits + RANGE_ADD_4)) & RANGE_MASK_4) != 0) {
    return U32.MAX_VALUE;
  }
  const pairs = (digits * 10 + (digits >> 16)) & U32_LO_PAIR;
  return <u32>((pairs * FINAL_4_MAGIC) >> 32);
}

/**
 * Same as {@link parse4Digits_PairMul} but with the validation step removed.
 * Used in consume-to-end paths where the caller has already bounded the
 * digit range, so per-stride validation isn't needed.
 *
 * @param block Four UTF-16 code units packed into a `u64`.
 * @returns The parsed 4-digit value.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function parse4Digits_PairMul_Unsafe(block: u64): u32 {
  const digits = block - ZERO_4;
  const pairs = (digits * 10 + (digits >> 16)) & U32_LO_PAIR;
  return <u32>((pairs * FINAL_4_MAGIC) >> 32);
}

/**
 * Parse eight UTF-16 ASCII digits across two `u64` blocks into one 8-digit
 * `u32` value.
 *
 * Caller passes two consecutive `u64` loads (16 source bytes). Validates
 * both halves with one combined check, then folds each half via
 * {@link parse4Digits_PairMul} and combines as `lo * 10_000 + hi`.
 *
 * Returns `U32.MAX_VALUE` on any non-digit lane.
 *
 * @param lo The first `u64`, four UTF-16 code units.
 * @param hi The second `u64`, four UTF-16 code units.
 * @returns The parsed 8-digit value, or `U32.MAX_VALUE` on invalid input.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function parse8Digits_PairMul(lo: u64, hi: u64): u32 {
  const loDigits = lo - ZERO_4;
  const hiDigits = hi - ZERO_4;
  const bad =
    (loDigits |
      (loDigits + RANGE_ADD_4) |
      hiDigits |
      (hiDigits + RANGE_ADD_4)) &
    RANGE_MASK_4;
  if (bad != 0) return U32.MAX_VALUE;

  const loPairs = (loDigits * 10 + (loDigits >> 16)) & U32_LO_PAIR;
  const hiPairs = (hiDigits * 10 + (hiDigits >> 16)) & U32_LO_PAIR;
  const loVal = <u32>((loPairs * FINAL_4_MAGIC) >> 32);
  const hiVal = <u32>((hiPairs * FINAL_4_MAGIC) >> 32);
  return loVal * 10_000 + hiVal;
}

/**
 * Same as {@link parse8Digits_PairMul} but with the validation step removed.
 * Used in consume-to-end paths.
 *
 * @param lo The first `u64`, four UTF-16 code units.
 * @param hi The second `u64`, four UTF-16 code units.
 * @returns The parsed 8-digit value.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function parse8Digits_PairMul_Unsafe(lo: u64, hi: u64): u32 {
  const loDigits = lo - ZERO_4;
  const hiDigits = hi - ZERO_4;
  const loPairs = (loDigits * 10 + (loDigits >> 16)) & U32_LO_PAIR;
  const hiPairs = (hiDigits * 10 + (hiDigits >> 16)) & U32_LO_PAIR;
  const loVal = <u32>((loPairs * FINAL_4_MAGIC) >> 32);
  const hiVal = <u32>((hiPairs * FINAL_4_MAGIC) >> 32);
  return loVal * 10_000 + hiVal;
}

/**
 * Non-digit lane mask for a `u64` holding four UTF-16 code units. Returns a
 * `u64` with bit 7 of each non-digit lane set, or 0 if all four lanes are
 * valid ASCII `'0'..'9'`. Lets a caller find the digit-run boundary in one
 * SWAR step:
 *
 * ```ts
 * const mask = nonDigitMask4(block);
 * if (mask == 0) { /* all valid *\/ }
 * else { const laneIdx = ctz(mask) >> 3; /* first bad byte *\/ }
 * ```
 *
 * @param block Four UTF-16 code units packed into a `u64`.
 * @returns A mask with non-digit lanes flagged in their high bit, or 0.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function nonDigitMask4(block: u64): u64 {
  const digits = (block & LANE_LO_4) - ZERO_4;
  return (digits | (digits + RANGE_ADD_4)) & RANGE_MASK_4;
}

/**
 * Parse sixteen UTF-16 ASCII digits (32 source bytes) into one 16-digit
 * `u64` value.
 *
 * Mirrors the SIMD 16-digit parser's shape using pure SWAR. Four `u64`
 * loads, one combined validation mask, four independent 4-digit folds (each
 * a chance for the engine to issue them in parallel), then a parallel-pair
 * tree combine.
 *
 * Best for long-integer atoi: one branch covers 16 digits, the four folds
 * have no cross-dependencies, and the final combine forms two independent
 * 8-digit values that merge in one mul-add.
 *
 * Returns `U64.MAX_VALUE` on any non-digit lane.
 *
 * @param srcStart Pointer to the start of 32 source bytes (16 UTF-16 chars).
 * @returns The parsed 16-digit value, or `U64.MAX_VALUE` on invalid input.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function parse16Digits_SWAR(srcStart: usize): u64 {
  const b0 = load<u64>(srcStart);
  const b1 = load<u64>(srcStart, 8);
  const b2 = load<u64>(srcStart, 16);
  const b3 = load<u64>(srcStart, 24);

  const d0 = b0 - ZERO_4;
  const d1 = b1 - ZERO_4;
  const d2 = b2 - ZERO_4;
  const d3 = b3 - ZERO_4;

  const bad =
    (d0 |
      (d0 + RANGE_ADD_4) |
      d1 |
      (d1 + RANGE_ADD_4) |
      d2 |
      (d2 + RANGE_ADD_4) |
      d3 |
      (d3 + RANGE_ADD_4)) &
    RANGE_MASK_4;
  if (bad != 0) return U64.MAX_VALUE;

  const p0 = (d0 * 10 + (d0 >> 16)) & U32_LO_PAIR;
  const p1 = (d1 * 10 + (d1 >> 16)) & U32_LO_PAIR;
  const p2 = (d2 * 10 + (d2 >> 16)) & U32_LO_PAIR;
  const p3 = (d3 * 10 + (d3 >> 16)) & U32_LO_PAIR;

  const v0 = <u32>((p0 * FINAL_4_MAGIC) >> 32);
  const v1 = <u32>((p1 * FINAL_4_MAGIC) >> 32);
  const v2 = <u32>((p2 * FINAL_4_MAGIC) >> 32);
  const v3 = <u32>((p3 * FINAL_4_MAGIC) >> 32);

  const pair01 = <u64>v0 * 10_000 + <u64>v1;
  const pair23 = <u64>v2 * 10_000 + <u64>v3;
  return pair01 * 100_000_000 + pair23;
}

/**
 * Same as {@link parse16Digits_SWAR} but with the validation step removed.
 * Used in consume-to-end paths.
 *
 * @param srcStart Pointer to the start of 32 source bytes (16 UTF-16 chars).
 * @returns The parsed 16-digit value.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function parse16Digits_SWAR_Unsafe(srcStart: usize): u64 {
  const b0 = load<u64>(srcStart);
  const b1 = load<u64>(srcStart, 8);
  const b2 = load<u64>(srcStart, 16);
  const b3 = load<u64>(srcStart, 24);

  const d0 = b0 - ZERO_4;
  const d1 = b1 - ZERO_4;
  const d2 = b2 - ZERO_4;
  const d3 = b3 - ZERO_4;

  const p0 = (d0 * 10 + (d0 >> 16)) & U32_LO_PAIR;
  const p1 = (d1 * 10 + (d1 >> 16)) & U32_LO_PAIR;
  const p2 = (d2 * 10 + (d2 >> 16)) & U32_LO_PAIR;
  const p3 = (d3 * 10 + (d3 >> 16)) & U32_LO_PAIR;

  const v0 = <u32>((p0 * FINAL_4_MAGIC) >> 32);
  const v1 = <u32>((p1 * FINAL_4_MAGIC) >> 32);
  const v2 = <u32>((p2 * FINAL_4_MAGIC) >> 32);
  const v3 = <u32>((p3 * FINAL_4_MAGIC) >> 32);

  const pair01 = <u64>v0 * 10_000 + <u64>v1;
  const pair23 = <u64>v2 * 10_000 + <u64>v3;
  return pair01 * 100_000_000 + pair23;
}
