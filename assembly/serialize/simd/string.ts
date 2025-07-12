import { bs } from "../../../lib/as-bs";
import { BACK_SLASH } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { bytes } from "../../util";

const U00_MARKER = 13511005048209500;

/**
 * Serializes strings into their JSON counterparts using SIMD operations
 * @param srcStart pointer to begin serializing at
 * @param srcEnd pointer to end serialization at
 */
export function serializeString_SIMD(src: string): void {
  const SPLAT_34 = i16x8.splat(34); /* " */
  const SPLAT_92 = i16x8.splat(92); /* \ */

  const SPLAT_32 = i16x8.splat(32); /* [ESC] */

  const srcSize = bytes(src);
  let srcStart = changetype<usize>(src);
  const srcEnd = srcStart + srcSize;
  const srcEnd16 = srcEnd - 16;

  bs.proposeSize(srcSize + 40);

  store<u8>(changetype<usize>(bs.offset), 34); /* " */
  bs.offset += 2;

  while (srcStart <= srcEnd16) {
    const block = v128.load(srcStart);

    v128.store(bs.offset, block);

    const backslash_indices = i16x8.eq(block, SPLAT_92);
    const quote_indices = i16x8.eq(block, SPLAT_34);
    const escape_indices = i16x8.lt_u(block, SPLAT_32);
    const sieve = v128.or(v128.or(backslash_indices, quote_indices), escape_indices);

    let mask = i16x8.bitmask(sieve);

    while (mask != 0) {
      const lane_index = ctz(mask) << 1;
      const src_offset = srcStart + lane_index;
      const code = load<u16>(src_offset) << 2;
      const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + code);
      mask &= mask - 1;
      if ((escaped & 0xffff) != BACK_SLASH) {
        bs.growSize(10);
        const dst_offset = bs.offset + lane_index;
        store<u64>(dst_offset, U00_MARKER);
        store<u32>(dst_offset, escaped, 8);
        v128.store(dst_offset, v128.load(src_offset, 2), 12);
        bs.offset += 10;
      } else {
        bs.growSize(2);
        const dst_offset = bs.offset + lane_index;
        store<u32>(dst_offset, escaped);
        v128.store(dst_offset, v128.load(src_offset, 2), 4);
        bs.offset += 2;
      }
    }

    srcStart += 16;
    bs.offset += 16;
  }

  while (srcStart <= srcEnd - 2) {
    const code = load<u16>(srcStart);
    if (code == 92 || code == 34 || code < 32) {
      const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
      if ((escaped & 0xffff) != BACK_SLASH) {
        bs.growSize(10);
        store<u64>(bs.offset, U00_MARKER);
        store<u32>(bs.offset, escaped, 8);
        bs.offset += 12;
      } else {
        bs.growSize(2);
        store<u32>(bs.offset, escaped);
        bs.offset += 4;
      }
    } else {
      store<u16>(bs.offset, code);
      bs.offset += 2;
    }
    srcStart += 2;
  }

  store<u8>(bs.offset, 34); /* " */
  bs.offset += 2;
}
