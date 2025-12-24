import { bs } from "../../../lib/as-bs";
import { BACK_SLASH } from "../../custom/chars";
import { DESERIALIZE_ESCAPE_TABLE, ESCAPE_HEX_TABLE } from "../../globals/tables";

// @ts-ignore: decorator allowed
@lazy const LANE_MASK_HIGH = 0xFF00_FF00_FF00_FF00;
// @ts-ignore: decorator allowed
@lazy const LANE_MASK_LOW = 0x00FF_00FF_00FF_00FF;
// @ts-ignore: decorator allowed
@lazy const UINT64_H8 = 0x8080808080808080;
// @ts-ignore: decorator allowed
@lazy const QUOTE_MASK = 0x0022_0022_0022_0022;
// @ts-ignore: decorator allowed
@lazy const BACKSLASH_MASK = 0x005C_005C_005C_005C;
// @ts-ignore: decorator allowed
@lazy const CONTROL_MASK = 0x0020_0020_0020_0020;
// @ts-ignore: decorator allowed
@lazy const U00_MARKER = 13511005048209500;

/**
 * Deserializes strings back into into their original form using SIMD operations
 * @param src string to deserialize
 * @param dst buffer to write to
 * @returns number of bytes written
 */
// todo: optimize and stuff. it works, its not pretty. ideally, i'd like this to be (nearly) branchless
export function deserializeString_SWAR(srcStart: usize, srcEnd: usize): void {
  srcStart += 2;
  srcEnd -= 2;
  bs.proposeSize(u32(srcEnd - srcStart));

//   const src_end_15 = srcEnd - 15;
//   while (srcStart < src_end_15) {
//     const block = load<u64>(srcStart);
//     store<u64>(dst_ptr, block);

//     let mask = v64x4_eq(block, BACKSLASH_MASK);

//     while (mask != 0) {
//       const lane_index = usize(ctz(mask) >> 3);
//       const dst_offset = dst_ptr + lane_index;
//       const src_offset = srcStart + lane_index;
//       const code = load<u16>(src_offset, 2);

//       mask &= mask - 1;
//       if (code == 117 && load<u32>(src_offset, 4) == 3145776) {
//         const block = load<u32>(src_offset, 8);
//         const codeA = block & 0xffff;
//         const codeB = (block >> 16) & 0xffff;
//         const escapedA = load<u8>(ESCAPE_HEX_TABLE + codeA);
//         const escapedB = load<u8>(ESCAPE_HEX_TABLE + codeB);
//         const escaped = (escapedA << 4) + escapedB;
//         // console.log("Escaped:");
//         // console.log("  a: " + escapedA.toString())
//         // console.log("  b: " + escapedB.toString());
//         // console.log("  c: " + escaped.toString());
//         // console.log("  o: " + (dst_ptr - dst).toString());
//         // console.log("  d: " + (dst_offset - dst).toString())
//         // console.log("  l: " + (lane_index).toString())
//         store<u16>(dst_offset, escaped);
//         memory.copy(dst_offset + 2, src_offset + 4, (4 - lane_index) << 1);
//         // v128.store(dst_offset, v128.load(src_offset, 4), 2);
//         if (lane_index >= 6) {
//           const bytes_left = lane_index - 4;
//           srcStart += bytes_left;
//           dst_ptr += bytes_left;
//           // console.log("  e: " + (bytes_left).toString())
//         }
//         dst_ptr -= 10;
//       } else {
//         const escaped = load<u8>(DESERIALIZE_ESCAPE_TABLE + code);
//         store<u16>(dst_offset, escaped);
//         memory.copy(dst_offset + 2, src_offset + 4, (4 - lane_index) << 1);
//         // v128.store(dst_offset, v128.load(src_offset, 4), 2);
//         // console.log("Escaped:");
//         if (lane_index == 14) {
//           srcStart += 2;
//         } else {
//           dst_ptr -= 2;
//         }
//       }
//     }

//     srcStart += 16;
//     dst_ptr += 16;

//     // console.log("src: " + (srcStart - changetype<usize>(src)).toString());
//     // console.log("dst: " + (dst_ptr - dst).toString());
//   }
  while (srcStart < srcEnd) {
    let code = load<u16>(srcStart);
    if (code == BACK_SLASH) {
      code = load<u16>(DESERIALIZE_ESCAPE_TABLE + load<u8>(srcStart, 2));
      if (code == 117 && load<u32>(srcStart, 4) == 3145776) {
        const block = load<u32>(srcStart, 8);
        const codeA = block & 0xffff;
        const codeB = (block >> 16) & 0xffff;
        const escapedA = load<u8>(ESCAPE_HEX_TABLE + codeA);
        const escapedB = load<u8>(ESCAPE_HEX_TABLE + codeB);
        const escaped = (escapedA << 4) + escapedB;
        store<u16>(bs.offset, escaped);
        bs.offset += 2;
        srcStart += 12;
      } else {
        store<u16>(bs.offset, code);
        bs.offset += 2;
        srcStart += 4;
      }
    } else {
      store<u16>(bs.offset, code);
      bs.offset += 2;
      srcStart += 2;
    }
  }
}

// @ts-ignore: decorators allowed
@inline function v64x4_eq(x: u64, y: u64): u64 {
  const xored = (x ^ LANE_MASK_HIGH) ^ y;
  const mask = (((xored >> 1) | UINT64_H8) - xored) & UINT64_H8;
  return (mask << 1) - (mask >> 7);
}

// @ts-ignore: decorators allowed
@inline function v64x4_ltu(a: u64, b: u64): u64 {
  // Vigna's algorithm - fastest SWAR unsigned less-than
  return (((a | UINT64_H8) - (b & ~UINT64_H8)) | (a ^ b)) ^ (a | ~b);
}