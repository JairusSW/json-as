import { v256r, v512r } from "as-simd/assembly/wide/wide";
import {
  json_escape_copy_utf16_64,
  json_escape_copy_utf16_64_v512,
  json_escape_copy_utf16_256_v512,
  json_escape_copy_utf16_bulk_v512,
  json_find_quote_backslash_utf16_64_v512,
} from "as-simd/assembly/wide/json";

/** Number of bytes consumed by the configured SIMD scan width. */
@inline
export function simdWidthBytes(): usize {
  if (JSON_SIMD_WIDTH == 512) return 64;
  if (JSON_SIMD_WIDTH == 256) return 32;
  return 16;
}

/** Fixed logical block size used by the fused UTF-16 JSON fast path. */
@inline
export function fusedStringBlockBytes(): usize {
  return 64;
}

/**
 * Copies one 64-byte UTF-16 block and returns one escape bit per code unit.
 *
 * Wago/Wide lowers the import directly to native wide SIMD. Other runtimes
 * retain as-simd's portable four-v128 implementation.
 */
@inline
export function copyStringAndEscapeMask64(dst: usize, src: usize): u32 {
  if (JSON_WAGO_WIDE) {
    if (JSON_SIMD_WIDTH == 512) return json_escape_copy_utf16_64_v512(src, dst);
    return json_escape_copy_utf16_64(src, dst);
  }
  return v512r.copy_json_escape_bitmask_utf16_64(src, dst);
}

/** Copy/classify four ZMM blocks with one bounds check and constant setup. */
@inline
export function copyStringAndEscapeMask256(dst: usize, src: usize): u32 {
  if (JSON_WAGO_WIDE && JSON_SIMD_WIDTH == 512)
    return json_escape_copy_utf16_256_v512(src, dst);
  return (
    v512r.copy_json_escape_bitmask_utf16_64(src, dst) |
    v512r.copy_json_escape_bitmask_utf16_64(src + 64, dst + 64) |
    v512r.copy_json_escape_bitmask_utf16_64(src + 128, dst + 128) |
    v512r.copy_json_escape_bitmask_utf16_64(src + 192, dst + 192)
  );
}

/** Copy/classify an inclusive run of complete ZMM blocks in one native loop. */
@inline
export function copyStringAndEscapeMaskBulkV512(
  dst: usize,
  src: usize,
  lastDst: usize,
  lastSrc: usize,
): u32 {
  return json_escape_copy_utf16_bulk_v512(src, dst, lastSrc, lastDst);
}

/** One mask bit per UTF-16 lane equal to `code`. */
@inline
export function wideEq16Mask(ptr: usize, code: i16): u64 {
  if (JSON_SIMD_WIDTH == 512) {
    return v512r.eq_splat_bitmask<i16>(ptr, code);
  }
  if (JSON_SIMD_WIDTH == 256) {
    return v256r.eq_splat_bitmask<i16>(ptr, code);
  }
  return <u64>i16x8.bitmask(i16x8.eq(load<v128>(ptr), i16x8.splat(code)));
}

/** One mask bit per UTF-16 lane equal to either `a` or `b`. */
@inline
export function wideEqEither16Mask(ptr: usize, a: i16, b: i16): u64 {
  if (JSON_SIMD_WIDTH == 512) {
    return v512r.eq_either_splat_bitmask<i16>(ptr, a, b);
  }
  if (JSON_SIMD_WIDTH == 256) {
    return v256r.eq_either_splat_bitmask<i16>(ptr, a, b);
  }
  const block = load<v128>(ptr);
  return <u64>(
    i16x8.bitmask(
      v128.or(i16x8.eq(block, i16x8.splat(a)), i16x8.eq(block, i16x8.splat(b))),
    )
  );
}

/** Quote-or-backslash lane mask using the fused AVX-512 JSON primitive. */
@inline
export function wideQuoteBackslashMask64(ptr: usize): u32 {
  if (JSON_WAGO_WIDE && JSON_SIMD_WIDTH == 512)
    return json_find_quote_backslash_utf16_64_v512(ptr);
  return <u32>v512r.eq_either_splat_bitmask<i16>(ptr, 0x22, 0x5c);
}

/**
 * Finds JSON string characters requiring the scalar escape path.
 *
 * One bit is returned per byte, matching the native i8x16 mask used by the
 * existing 128-bit serializer. For UTF-16 ASCII lanes only the even bit can
 * be set; non-ASCII or surrogate bytes can also set the high-byte bit.
 */
@inline
export function wideStringEscapeMask(ptr: usize): u64 {
  if (JSON_SIMD_WIDTH == 512) {
    return v512r.json_escape_bitmask_utf16(ptr);
  }
  if (JSON_SIMD_WIDTH == 256) {
    return v256r.json_escape_bitmask_utf16(ptr);
  }
  const block = load<v128>(ptr);
  return <u64>(
    i8x16.bitmask(
      v128.or(
        i16x8.eq(block, i16x8.splat(0x22)),
        v128.or(
          i16x8.eq(block, i16x8.splat(0x5c)),
          v128.or(
            i16x8.lt_u(block, i16x8.splat(0x20)),
            i8x16.gt_u(block, i16x8.splat(i16(0xd7fe))),
          ),
        ),
      ),
    )
  );
}

/** Copy one configured-width vector from `src` to `dst`. */
@inline
export function copyWide(dst: usize, src: usize): void {
  if (JSON_SIMD_WIDTH == 512) {
    v512r.copy(dst, src);
  } else if (JSON_SIMD_WIDTH == 256) {
    v256r.copy(dst, src);
  } else {
    store<v128>(dst, load<v128>(src));
  }
}
