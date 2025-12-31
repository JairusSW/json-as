import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { bs, sc } from "../../../lib/as-bs";
import { BACK_SLASH } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
// @ts-ignore: decorator allowed
@lazy const U00_MARKER = 13511005048209500;
// @ts-ignore: decorator allowed
@lazy const U_MARKER = 7667804;
// @ts-ignore: decorator allowed
@lazy const SPLAT_0022 = i16x8.splat(0x0022); // "
// @ts-ignore: decorator allowed
@lazy const SPLAT_005C = i16x8.splat(0x005C); // \
// @ts-ignore: decorator allowed
@lazy const SPLAT_0020 = i16x8.splat(0x0020); // space and control check
// @ts-ignore: decorator allowed
@lazy const SPLAT_FFD8 = i16x8.splat(i16(0xD7FE));

/**
 * Serializes strings into their JSON counterparts using SIMD operations
 */
export function serializeString_SIMD(src: string): void {
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
  const srcEnd16 = srcEnd - 16;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, 34); // "
  bs.offset += 2;

  while (srcStart < srcEnd16) {
    const block = v128.load(srcStart);
    v128.store(bs.offset, block);

    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    // console.log("\nblock  : " + mask_to_string_v128(block));
    // console.log("eq22   : " + mask_to_string_v128(eq22) + " -> " + mask_to_string_v128(SPLAT_0022));
    // console.log("eq5C   : " + mask_to_string_v128(eq5C) + " -> " + mask_to_string_v128(SPLAT_005C));
    // console.log("lt20   : " + mask_to_string_v128(lt20) + " -> " + mask_to_string_v128(SPLAT_0020));
    // console.log("gteD8  : " + mask_to_string_v128(gteD8) + " -> " + mask_to_string_v128(SPLAT_FFD8));

    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));
    // console.log("sieve  : " + mask_to_string_v128(sieve));

    if (v128.any_true(sieve)) {

      let mask = i8x16.bitmask(sieve);

      if (mask === 0) {
        bs.offset += 16;
        srcStart += 16;
        continue;
      }

      do {
        const laneIdx = ctz(mask);
        const srcIdx = srcStart + laneIdx;

        mask &= mask - 1;
        // Even (0 2 4 6 8 10 12 14) -> Confirmed ASCII Escape
        // Odd (1 3 5 7 9 11 13 15) -> Possibly a Unicode code unit or surrogate

        if ((laneIdx & 1) === 0) {
          const code = load<u16>(srcIdx);
          const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));

          if ((escaped & 0xffff) != BACK_SLASH) {
            bs.growSize(10);
            const dstIdx = bs.offset + laneIdx;
            store<u64>(dstIdx, U00_MARKER);
            store<u32>(dstIdx, escaped, 8);
            // memory.copy(dstIdx + 12, srcIdx + 2, 14 - laneIdx);
            store<v128>(dstIdx, load<v128>(srcIdx, 2), 12); // unsafe. can overflow here
            bs.offset += 10;
          } else {
            bs.growSize(2);
            const dstIdx = bs.offset + laneIdx;
            store<u32>(dstIdx, escaped);
            store<v128>(dstIdx, load<v128>(srcIdx, 2), 4);
            // memory.copy(dstIdx + 4, srcIdx + 2, 14 - laneIdx);
            bs.offset += 2;
          }
          continue;
        }

        const code = load<u16>(srcIdx - 1);
        // console.log("\nb->" + mask_to_string_v128(block));
        // console.log("h->" + mask_to_string_v128(sieve));
        // console.log("z->" + mask_to_string_v128(i8x16.ge_u(block,SPLAT_FFD8)));
        // console.log("m->" + mask.toString(2));
        // console.log("l->" + laneIdx.toString());
        // console.log("c->" + code.toString(16));
        if (code < 0xD800 || code > 0xDFFF) continue;

        if (code <= 0xDBFF && srcIdx + 1 <= srcEnd - 2) {
          const next = load<u16>(srcIdx, 1);
          if (next >= 0xDC00 && next <= 0xDFFF) {
            // paired surrogate
            mask &= mask - 1;
            continue;
          }
        }

        bs.growSize(10);
        // unpaired high/low surrogate
        const dstIdx = bs.offset + laneIdx - 1;
        store<u32>(dstIdx, U_MARKER); // \u
        store<u64>(dstIdx, load<u64>(changetype<usize>(code.toString(16))), 4);
        // memory.copy(dstIdx + 12, srcIdx + 1, 15 - laneIdx);
        store<v128>(dstIdx, load<v128>(srcIdx, 1), 12);
        bs.offset += 10;
      } while (mask !== 0);
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