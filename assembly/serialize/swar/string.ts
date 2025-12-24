import { bs } from "../../../lib/as-bs";
import { BACK_SLASH } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { bytes } from "../../util/bytes";


// @ts-ignore: decorator allowed
@lazy const LANE_MASK_HIGH = 0xFF00_FF00_FF00_FF00;
// @ts-ignore: decorator allowed
@lazy const ONES: u64 = 0x0101010101010101;
// @ts-ignore: decorator allowed
@lazy const LANE_MASK_LOW = 0x00FF_00FF_00FF_00FF;
// @ts-ignore: decorator allowed
@lazy const HIGHS = 0x8080808080808080;
// @ts-ignore: decorator allowed
@lazy const QUOTE_MASK = 0x0022_0022_0022_0022;
// @ts-ignore: decorator allowed
@lazy const BACKSLASH_MASK = 0x005C_005C_005C_005C;
// @ts-ignore: decorator allowed
@lazy const CONTROL_MASK = 0x0020_0020_0020_0020;
// @ts-ignore: decorator allowed
@lazy const U00_MARKER = 13511005048209500;

export function serializeString_SWAR(src: string): void {
  const srcSize = bytes(src);
  let srcStart = changetype<usize>(src);
  const srcEnd = srcStart + srcSize;
  const srcEnd8 = srcEnd - 8;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, 34); // "
  bs.offset += 2;

  while (srcStart <= srcEnd8) {
    const block = load<u64>(srcStart);
    store<u64>(bs.offset, block);

    let mask = v64x4_should_escape(block);

    while (mask != 0) {
      const lane_index = usize(ctz(mask) >> 3); // 0 2 4 6
      const src_offset = srcStart + lane_index;
      // const dst_offset = bs.offset + lane_index;
      const code = load<u16>(src_offset) << 2;
      // console.log("lane: " + lane_index.toString())
      const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + code);

      mask = mask & ~(0xFF << (lane_index << 3));
      if ((escaped & 0xffff) != BACK_SLASH) {
        bs.growSize(10);
        const dst_offset = bs.offset + lane_index;
        store<u64>(dst_offset, U00_MARKER);
        store<u32>(dst_offset, escaped, 8);
        store<u64>(dst_offset, load<u64>(src_offset, 2), 12); // unsafe. can overflow here
        // memory.copy(dst_offset + 12, src_offset + 2, (4 - lane_index) << 1);
        bs.offset += 10;
      } else {
        bs.growSize(2);
        const dst_offset = bs.offset + lane_index;
        store<u32>(dst_offset, escaped);
        store<u64>(dst_offset, load<u64>(src_offset, 2), 4);
        // memory.copy(dst_offset + 4, src_offset + 2, (4 - lane_index) << 1);
        bs.offset += 2;
      }
    }

    srcStart += 8;
    bs.offset += 8;
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

  store<u16>(bs.offset, 34); // "
  bs.offset += 2;
}

// @ts-ignore: decorators allowed
@inline function v64x4_should_escape(x: u64): u64 {
  x = x ^ 0xFF00FF00FF00FF00;
  
  const is_ascii: u64 = HIGHS & ~x;
  const xor2: u64 = x ^ 0x0202020202020202;
  const lt32_or_eq34: u64 = xor2 - 0x2121212121212121;
  const sub92: u64 = x ^ 0x5C5C5C5C5C5C5C5C;
  const eq92: u64 = sub92 - ONES;
  
  const high_bits: u64 = (lt32_or_eq34 | eq92) & is_ascii;
  
  return high_bits
}