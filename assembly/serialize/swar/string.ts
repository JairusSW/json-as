import { bs, sc } from "../../../lib/as-bs";
import { BACK_SLASH } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { mask_to_string } from "../../util/masks";
import { ptrToStr } from "../../util/ptrToStr";


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
// @ts-ignore: decorator allowed
@lazy const U_MARKER = 7667804;


export function serializeString_SWAR(src: string): void {
  let srcStart = changetype<usize>(src);

  if (isDefined(JSON_CACHE)) {
    // check cache
    const e = unchecked(sc.entries[(srcStart >> 4) & sc.CACHE_MASK]);
    if (e.key == srcStart) {
      // bs.offset += e.len;
      // bs.stackSize += e.len;
      bs.cacheOutput = e.ptr;
      bs.cacheOutputLen = e.len;
      return;
    }
  }

  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize
  const srcEnd = srcStart + srcSize;
  const srcEnd8 = srcEnd - 8;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, 34); // "
  bs.offset += 2;

  while (srcStart <= srcEnd8) {
    const block = load<u64>(srcStart);
    store<u64>(bs.offset, block);

    let non_ascii = block & 0x8080_8080_8080_8080;
    let handled_lanes_mask = non_ascii;

    while (non_ascii !== 0) {
      let lane_index = usize(ctz(non_ascii) >> 3);
      const src_offset = srcStart + lane_index - 1;
      const dst_offset = bs.offset + lane_index - 1

      const code = load<u16>(src_offset);

      // let type: string = "";
      // console.log("-------------------------")
      // console.log("Data:   " + ptrToStr(srcStart, srcStart + 8));
      // console.log("Block:  " + mask_to_string(block));
      // console.log("Mask:   " + mask_to_string(non_ascii));
      // console.log("Lane:   " + (lane_index - 1).toString());
      // console.log("CTZ:    " + ctz(non_ascii).toString());
      // console.log("Code:   " + code.toString(16));

      if (code >= 0xD800 && code <= 0xDBFF) {
        // surrogate
        if (src_offset + 2 <= srcEnd - 2) {
          const next = load<u16>(src_offset, 2);
          if (next >= 0xDC00 && next <= 0xDFFF) {
            non_ascii &= ~(0xFF << (lane_index << 3));
            lane_index += 2;
            // type = "surrogate pair";
            non_ascii &= ~(0xFF << (lane_index << 3));
            continue;
          }
        }
        bs.growSize(8);
        // type = "unpaired surrogate 1";
        non_ascii &= ~(0xFF << (lane_index << 3));
        // console.log("src_offset: " + load<u8>(src_offset).toString(16))
        // console.log("dst_offset: " + load<u8>(dst_offset).toString(16))
        store<u32>(dst_offset, U_MARKER); // \u
        store<u64>(dst_offset, load<u64>(changetype<usize>(code.toString(16))), 4);
        store<u64>(dst_offset, load<u64>(src_offset, 2), 12);
        bs.offset += 10;
        continue;
      }
      if (code >= 0xDC00 && code <= 0xDFFF) {
        bs.growSize(8);
        // type = "unpaired surrogate 2";
        non_ascii &= ~(0xFF << (lane_index << 3));
        // console.log("src_offset: " + load<u8>(src_offset).toString(16))
        // console.log("dst_offset: " + load<u8>(dst_offset).toString(16))
        store<u32>(dst_offset, U_MARKER); // \u
        store<u64>(dst_offset, load<u64>(changetype<usize>(code.toString(16))), 4);
        store<u64>(dst_offset, load<u64>(src_offset, 2), 12);
        bs.offset += 10;
        continue;
      }

      // console.log("Type:   " + type);

      non_ascii &= ~(0xFF << (lane_index << 3));
      // handled_lanes_mask |= <u64>0x80 << (lane_index << 3);

      // console.log("ASCII:  " + mask_to_string(handled_lanes_mask >> 8));
    }
    // after all possible code units/surrogates are handled, we're left with ascii.
    let mask = v64x4_should_escape(block) & ~(handled_lanes_mask >> 8);
    // mask &= ~may_be_non_ascii_lanes; // mask out lanes that were surrogates. leave ascii
    // handle ascii escapes & control codes
    while (mask != 0) {
      const lane_index = usize(ctz(mask) >> 3); // 0 2 4 6
      const src_offset = srcStart + lane_index;
      // const dst_offset = bs.offset + lane_index;
      const code = load<u16>(src_offset) << 2;
      // console.log("lane: " + lane_index.toString())
      const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + code);

      // console.log("+++++++++++++++++++++++++")
      // console.log("Data:  (" + ptrToStr(srcStart, srcStart + 8) + ")");
      // console.log("Block:  " + mask_to_string(block));
      // console.log("Mask:   " + mask_to_string(mask));
      // console.log("Lane:   " + lane_index.toString());
      // console.log("CodeA:  " + load<u8>(src_offset).toString(16));
      // console.log("CodeB:  " + load<u8>(src_offset, 1).toString(16));

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
      srcStart += 2;
      continue;
    }

    // High surrogate
    if (code >= 0xD800 && code <= 0xDBFF) {
      if (srcStart + 2 <= srcEnd - 2) {
        const next = load<u16>(srcStart, 2);
        if (next >= 0xDC00 && next <= 0xDFFF) {
          // valid surrogate pair
          store<u16>(bs.offset, code);
          store<u16>(bs.offset + 2, next);
          bs.offset += 4;
          srcStart += 4;
          continue;
        }
      }
      // unpaired high surrogate
      write_u_escape(code);
      srcStart += 2;
      continue;
    }

    // Low surrogate
    if (code >= 0xDC00 && code <= 0xDFFF) {
      write_u_escape(code);
      srcStart += 2;
      continue;
    }

    store<u16>(bs.offset, code);
    bs.offset += 2;
    srcStart += 2;
  }

  store<u16>(bs.offset, 34); // "
  bs.offset += 2;

  if (isDefined(JSON_CACHE)) sc.insertCached(changetype<usize>(src), srcStart, srcSize);
}

// @ts-ignore: decorators allowed
@inline function v64x4_should_escape(x: u64): u64 {
  // console.log("input:    " + mask_to_string(x));
  // const hi = x & 0xff00_ff00_ff00_ff00;
  // const lo = x & 0x00ff_00ff_00ff_00ff;
  x &= 0x00ff_00ff_00ff_00ff;
  // const is_cp = hi & 0x8080_8080_8080_8080;
  const is_ascii = 0x0080_0080_0080_0080 & ~x; // lane remains 0x80 if ascii
  const lt32 = (x - 0x0020_0020_0020_0020);
  const sub34 = x ^ 0x0022_0022_0022_0022;
  const eq34 = (sub34 - 0x0001_0001_0001_0001);
  const sub92 = x ^ 0x005C_005C_005C_005C;
  const eq92 = (sub92 - 0x0001_0001_0001_0001);
  // console.log("low:      " + mask_to_string(lo));
  // console.log("high:     " + mask_to_string(hi));
  // console.log("is_cp:    " + mask_to_string(is_cp));
  // console.log("is_ascii: " + mask_to_string(is_ascii));
  // console.log("lt32:     " + mask_to_string(lt32));
  // console.log("sub34:    " + mask_to_string(sub34));
  // console.log("eq34:     " + mask_to_string(eq34));
  // console.log("eq92:     " + mask_to_string(eq92));
  // console.log("pre:      " + mask_to_string((lt32 | eq34 | eq92)));
  // console.log("out:      " + mask_to_string((lt32 | eq34 | eq92) & is_ascii));
  return ((lt32 | eq34 | eq92) & is_ascii);
}

@inline function write_u_escape(code: u16): void {
  bs.growSize(10);
  store<u32>(bs.offset, U_MARKER); // "\u"
  // write hex digits (lowercase, matches tests)
  store<u16>(bs.offset + 4, hexNibble((code >> 12) & 0xF));
  store<u16>(bs.offset + 6, hexNibble((code >> 8) & 0xF));
  store<u16>(bs.offset + 8, hexNibble((code >> 4) & 0xF));
  store<u16>(bs.offset + 10, hexNibble(code & 0xF));
  bs.offset += 12;
}

@inline function hexNibble(n: u16): u16 {
  return n < 10 ? (48 + n) : (87 + n);
}
