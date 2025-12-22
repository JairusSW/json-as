import { bs } from "../../../lib/as-bs";
import { BACK_SLASH } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { bytes } from "../../util/bytes";

// @ts-ignore: decorator allowed
@lazy const QUOTE_MASK = 0x0022_0022_0022_0022;
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

    const quotes = COMP(block, QUOTE_MASK);
    let mask = quotes;


    while (mask != 0) {
      const lane_index = usize(ctz(mask) >> 3);
      // console.log("lane index "  + lane_index.toString());
      const src_offset = srcStart + lane_index;
      const code = load<u16>(src_offset) << 2;
      const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + code);

      if ((escaped & 0xffff) != BACK_SLASH) {
        bs.growSize(10);
        const dst_offset = bs.offset + lane_index;
        store<u64>(dst_offset, U00_MARKER);
        store<u32>(dst_offset, escaped, 8);
        store<u64>(dst_offset, load<u64>(src_offset, 2), 12); // unsafe. can overflow here
        bs.offset += 10;
      } else {
        bs.growSize(2);
        const dst_offset = bs.offset + lane_index;
        store<u32>(dst_offset, escaped);
        store<u64>(dst_offset, load<u64>(src_offset, 2), 4);
        bs.offset += 2;
      }

      mask &= mask - 1;
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
@inline function COMP(x: u64, y: u64): u64 {
  const LANE_MASK = 0xFF00_FF00_FF00_FF00;
  const xored = (x ^ LANE_MASK) ^ y;
  const mask = (((xored >> 1) | 0x8080808080808080) - xored) & 0x8080808080808080;
  return (mask << 1) - (mask >> 7) & 0x8080808080808080;
}
