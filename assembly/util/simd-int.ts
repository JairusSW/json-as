// SIMD (v128) integer-digit parsing kernels over UTF-16 sources.
//
// Requires `--enable simd` at compile time. Imported only by the SIMD-mode
// dispatch paths and dead-code-eliminated when JSON_MODE != SIMD.
//
// Algorithm is the Lemire-style narrow-extmul-dot pipeline used by simdjson:
//
// 1. `i16x8.sub` subtracts `'0'` from each UTF-16 lane.
// 2. `i8x16.narrow_i16x8_u` packs two 8-lane u16 vectors into one 16-lane u8
//    vector. This pack is free in SIMD and is the move that makes the SWAR
//    packing problem disappear.
// 3. `i16x8.extmul_low/high_i8x16_u(packed, (10, 1, ...))` multiplies
//    adjacent bytes by 10 and 1, encoding the first pair-fold step in a
//    vector op.
// 4. `i32x4.extadd_pairwise_i16x8_u` pairwise-sums adjacent u16 lanes into
//    u32 lanes, completing the first pair-fold.
// 5. `i16x8.narrow_i32x4_u + i32x4.dot_i16x8_s(_, (100, 1, 100, 1, ...))`
//    folds 4 u32 pair-values into 2 u32 group-values per lane via dot
//    product.

// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_30 = i16x8.splat(0x30);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_09 = i16x8.splat(9);
// @ts-expect-error: @lazy is a valid decorator
@lazy const ZERO_I16X8 = i16x8.splat(0);
// @ts-expect-error: @lazy is a valid decorator
@lazy const ZERO_I32X4 = i32x4.splat(0);

// Weights for the first pair-fold step (`digit_lo * 10 + digit_hi`).
// @ts-expect-error: @lazy is a valid decorator
@lazy const PACK_WEIGHTS_10_1 = i8x16(
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
);
// @ts-expect-error: @lazy is a valid decorator
@lazy const PACK_WEIGHTS_10_1_FULL = i8x16(
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
  10,
  1,
);

// Weights for the second fold step (`pair_lo * 100 + pair_hi`).
// @ts-expect-error: @lazy is a valid decorator
@lazy const PAIR_WEIGHTS_100_1 = i16x8(100, 1, 100, 1, 0, 0, 0, 0);
// @ts-expect-error: @lazy is a valid decorator
@lazy const PAIR_WEIGHTS_100_1_FULL = i16x8(100, 1, 100, 1, 100, 1, 100, 1);

/**
 * Parse eight UTF-16 ASCII digits (16 source bytes) into the 8-digit `u32`
 * value using SIMD.
 *
 * Returns `U32.MAX_VALUE` on any non-digit lane.
 *
 * @param srcStart Pointer to 16 source bytes (8 UTF-16 chars).
 * @returns The parsed 8-digit value, or `U32.MAX_VALUE` on invalid input.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function parse8Digits_SIMD(srcStart: usize): u32 {
  const block = load<v128>(srcStart);
  const digits = i16x8.sub(block, SPLAT_30);
  if (v128.any_true(i16x8.gt_u(digits, SPLAT_09))) return U32.MAX_VALUE;
  const packed = i8x16.narrow_i16x8_u(digits, ZERO_I16X8);
  const products = i16x8.extmul_low_i8x16_u(packed, PACK_WEIGHTS_10_1);
  const pairs = i32x4.extadd_pairwise_i16x8_u(products);
  const pairs16 = i16x8.narrow_i32x4_u(pairs, ZERO_I32X4);
  const groups = i32x4.dot_i16x8_s(pairs16, PAIR_WEIGHTS_100_1);
  const lo = i32x4.extract_lane(groups, 0);
  const hi = i32x4.extract_lane(groups, 1);
  return <u32>lo * 10_000 + <u32>hi;
}

/**
 * Same as {@link parse8Digits_SIMD} but with the validation step removed.
 * Used in consume-to-end paths.
 *
 * @param srcStart Pointer to 16 source bytes (8 UTF-16 chars).
 * @returns The parsed 8-digit value.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function parse8Digits_SIMD_Unsafe(srcStart: usize): u32 {
  const block = load<v128>(srcStart);
  const digits = i16x8.sub(block, SPLAT_30);
  const packed = i8x16.narrow_i16x8_u(digits, ZERO_I16X8);
  const products = i16x8.extmul_low_i8x16_u(packed, PACK_WEIGHTS_10_1);
  const pairs = i32x4.extadd_pairwise_i16x8_u(products);
  const pairs16 = i16x8.narrow_i32x4_u(pairs, ZERO_I32X4);
  const groups = i32x4.dot_i16x8_s(pairs16, PAIR_WEIGHTS_100_1);
  const lo = i32x4.extract_lane(groups, 0);
  const hi = i32x4.extract_lane(groups, 1);
  return <u32>lo * 10_000 + <u32>hi;
}

/**
 * Parse sixteen UTF-16 ASCII digits (32 source bytes) into one 16-digit
 * `u64` value using SIMD.
 *
 * Two `v128` loads. Combined OR'd validation across both halves means one
 * branch covers all 16 digits. Both halves' `extmul`s feed a single dot
 * product, producing 4 four-digit groups that the final parallel-pair
 * scalar combine merges.
 *
 * Returns `U64.MAX_VALUE` on any non-digit lane.
 *
 * @param srcStart Pointer to 32 source bytes (16 UTF-16 chars).
 * @returns The parsed 16-digit value, or `U64.MAX_VALUE` on invalid input.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function parse16Digits_SIMD(srcStart: usize): u64 {
  const block0 = load<v128>(srcStart);
  const block1 = load<v128>(srcStart, 16);

  const digits0 = i16x8.sub(block0, SPLAT_30);
  const digits1 = i16x8.sub(block1, SPLAT_30);

  const bad0 = i16x8.gt_u(digits0, SPLAT_09);
  const bad1 = i16x8.gt_u(digits1, SPLAT_09);
  if (v128.any_true(v128.or(bad0, bad1))) return U64.MAX_VALUE;

  const packed = i8x16.narrow_i16x8_u(digits0, digits1);
  const products_lo = i16x8.extmul_low_i8x16_u(packed, PACK_WEIGHTS_10_1_FULL);
  const products_hi = i16x8.extmul_high_i8x16_u(packed, PACK_WEIGHTS_10_1_FULL);
  const pairs_lo = i32x4.extadd_pairwise_i16x8_u(products_lo);
  const pairs_hi = i32x4.extadd_pairwise_i16x8_u(products_hi);
  const pairs16 = i16x8.narrow_i32x4_u(pairs_lo, pairs_hi);
  const groups = i32x4.dot_i16x8_s(pairs16, PAIR_WEIGHTS_100_1_FULL);

  const g0 = i32x4.extract_lane(groups, 0);
  const g1 = i32x4.extract_lane(groups, 1);
  const g2 = i32x4.extract_lane(groups, 2);
  const g3 = i32x4.extract_lane(groups, 3);
  const pair01 = <u64>g0 * 10_000 + <u64>g1;
  const pair23 = <u64>g2 * 10_000 + <u64>g3;
  return pair01 * 100_000_000 + pair23;
}

/**
 * Same as {@link parse16Digits_SIMD} but with the validation step removed.
 * Used in consume-to-end paths.
 *
 * @param srcStart Pointer to 32 source bytes (16 UTF-16 chars).
 * @returns The parsed 16-digit value.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function parse16Digits_SIMD_Unsafe(srcStart: usize): u64 {
  const block0 = load<v128>(srcStart);
  const block1 = load<v128>(srcStart, 16);
  const digits0 = i16x8.sub(block0, SPLAT_30);
  const digits1 = i16x8.sub(block1, SPLAT_30);
  const packed = i8x16.narrow_i16x8_u(digits0, digits1);
  const products_lo = i16x8.extmul_low_i8x16_u(packed, PACK_WEIGHTS_10_1_FULL);
  const products_hi = i16x8.extmul_high_i8x16_u(packed, PACK_WEIGHTS_10_1_FULL);
  const pairs_lo = i32x4.extadd_pairwise_i16x8_u(products_lo);
  const pairs_hi = i32x4.extadd_pairwise_i16x8_u(products_hi);
  const pairs16 = i16x8.narrow_i32x4_u(pairs_lo, pairs_hi);
  const groups = i32x4.dot_i16x8_s(pairs16, PAIR_WEIGHTS_100_1_FULL);
  const g0 = i32x4.extract_lane(groups, 0);
  const g1 = i32x4.extract_lane(groups, 1);
  const g2 = i32x4.extract_lane(groups, 2);
  const g3 = i32x4.extract_lane(groups, 3);
  const pair01 = <u64>g0 * 10_000 + <u64>g1;
  const pair23 = <u64>g2 * 10_000 + <u64>g3;
  return pair01 * 100_000_000 + pair23;
}
