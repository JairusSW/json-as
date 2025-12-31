import { bs, sc } from "../../../lib/as-bs";
import { BACK_SLASH } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { mask_to_string } from "../../util/masks";

// @ts-ignore: decorator allowed
@lazy const U00_MARKER = 13511005048209500;
// @ts-ignore: decorator allowed
@lazy const U_MARKER = 7667804;
// @ts-ignore: decorator allowed
@lazy const LOW_MASK = 0x00FF_00FF_00FF_00FF;
// @ts-ignore: decorator allowed
@lazy @inline const FILTER_0020 = 0x0020_0020_0020_0020;
// @ts-ignore: decorator allowed
@lazy @inline const FILTER_0022 = 0x0022_0022_0022_0022;
// @ts-ignore: decorator allowed
@lazy @inline const FILTER_005C = 0x005C_005C_005C_005C;
// @ts-ignore: decorator allowed
@lazy @inline const FILTER_0001 = 0x0001_0001_0001_0001;
// @ts-ignore: decorator allowed
@lazy @inline const FILTER_0080 = 0x0080_0080_0080_0080;
// @ts-ignore: decorator allowed
@lazy @inline const FILTER_0100 = 0x0100_0100_0100_0100;
// @ts-ignore: decorator allowed
@lazy @inline const FILTER_8000 = 0x8000_8000_8000_8000;

export function serializeString_SWAR(src: string): void {
  let srcStart = changetype<usize>(src);

  if (isDefined(JSON_CACHE)) {
    const e = unchecked(sc.entries[(srcStart >> 4) & sc.CACHE_MASK]);
    if (e.key == srcStart) {
      bs.offset += e.len;
      bs.stackSize += e.len;
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

  while (srcStart < srcEnd8) {
    let block = load<u64>(srcStart);
    store<u64>(bs.offset, block);

    const lo = block & LOW_MASK;
    const ascii_mask = (
      ((lo - FILTER_0020) |
        ((lo ^ FILTER_0022) - FILTER_0001) |
        ((lo ^ FILTER_005C) - FILTER_0001))
      & (FILTER_0080 & ~lo)
    );
    const hi_mask = ((block - FILTER_0100) & ~block & FILTER_8000) ^ FILTER_8000;
    let mask = (ascii_mask & (~hi_mask >> 8)) | hi_mask;

    // if (mask === 0) {
    //   srcStart += 8;
    //   bs.offset += 8;
    //   continue;
    // }

    while (mask !== 0) {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      // Even (0 2 4 6) -> Confirmed ASCII Escape
      // Odd (1 3 5 7) -> Possibly a Unicode code unit or surrogate
      const srcIdx = srcStart + laneIdx;
      if ((laneIdx & 1) === 0) {
        const code = load<u16>(srcIdx);
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));

        if ((escaped & 0xffff) != BACK_SLASH) {
          bs.growSize(10);
          const dstIdx = bs.offset + laneIdx;
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, escaped, 8);
          // memory.copy(dstIdx + 12, srcIdx + 2, 6 - laneIdx);
          store<u64>(dstIdx, load<u64>(srcIdx, 2), 12); // unsafe. can overflow here
          bs.offset += 10;
        } else {
          bs.growSize(2);
          const dstIdx = bs.offset + laneIdx;
          store<u32>(dstIdx, escaped);
          store<u64>(dstIdx, load<u64>(srcIdx, 2), 4);
          // memory.copy(dstIdx + 4, srcIdx + 2, 6 - laneIdx);
          bs.offset += 2;
        }
        continue;
      }

      const code = load<u16>(srcIdx - 1);
      // console.log("b->" + mask_to_string(block));
      // console.log("m->" + mask_to_string(mask));
      // console.log("l->" + laneIdx.toString());
      // console.log("c->" + code.toString(16));
      if (code < 0xD800 || code > 0xDFFF) continue;

      if (code <= 0xDBFF && srcIdx + 2 < srcEnd) {
        // if (srcIdx + 3 <= srcEnd) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xDC00 && next <= 0xDFFF) {
          // paired surrogate
          mask &= mask - 1;
          continue;
        }
        // }
      }

      bs.growSize(10);
      // unpaired high/low surrogate
      const dstIdx = bs.offset + laneIdx - 1;
      store<u32>(dstIdx, U_MARKER); // \u
      store<u64>(dstIdx, load<u64>(changetype<usize>(code.toString(16))), 4);
      store<u64>(dstIdx, load<u64>(srcIdx, 1), 12);
      bs.offset += 10;
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

    if (code < 0xD800 || code > 0xDFFF) {
      store<u16>(bs.offset, code);
      bs.offset += 2;
      srcStart += 2;
      continue;
    }

    if (code <= 0xDBFF && srcStart + 2 <= srcEnd - 2) {
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

    // unpaired high/low surrogate
    write_u_escape(code);
    srcStart += 2;
    continue;
  }

  store<u16>(bs.offset, 34); // "
  bs.offset += 2;

  if (isDefined(JSON_CACHE)) sc.insertCached(changetype<usize>(src), srcStart, srcSize);
}

// @ts-ignore: inline
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

// @ts-ignore: inline
@inline function hexNibble(n: u16): u16 {
  return n < 10 ? (48 + n) : (87 + n);
}