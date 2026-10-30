import { bs } from "../../../lib/as-bs";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { u16_to_hex4_swar } from "../../util/swar";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

// @ts-expect-error: @lazy is a valid decorator
@lazy const U00_MARKER = 13511005048209500;
// @ts-expect-error: @lazy is a valid decorator
@lazy const U_MARKER = 7667804;

export function serializeString_SWAR(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcInitial = srcStart;
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  do {
    const srcEnd8Fast = srcEnd - 8;
    bs.proposeSize(srcSize + 4);

    const dstStart = bs.offset;
    let dst = dstStart + 2;

    if (
      srcStart <= srcEnd8Fast &&
      (load<u64>(srcStart) & 0xff00_ff00_ff00_ff00) != 0
    ) {
      // A BMP-leading string takes a dedicated path so the overwhelmingly
      // common ASCII loop below stays byte-for-byte simple.
      while (srcStart <= srcEnd8Fast) {
        const block = load<u64>(srcStart);
        // Ordinary BMP code units can be copied verbatim. Only JSON ASCII
        // escapes and surrogate code units require the slow path.
        const c0 = <u16>block;
        const c1 = <u16>(block >> 16);
        const c2 = <u16>(block >> 32);
        const c3 = <u16>(block >> 48);
        if (
          c0 < 32 ||
          c0 == QUOTE ||
          c0 == BACK_SLASH ||
          <u16>(c0 - 0xd800) <= 0x07ff ||
          c1 < 32 ||
          c1 == QUOTE ||
          c1 == BACK_SLASH ||
          <u16>(c1 - 0xd800) <= 0x07ff ||
          c2 < 32 ||
          c2 == QUOTE ||
          c2 == BACK_SLASH ||
          <u16>(c2 - 0xd800) <= 0x07ff ||
          c3 < 32 ||
          c3 == QUOTE ||
          c3 == BACK_SLASH ||
          <u16>(c3 - 0xd800) <= 0x07ff
        )
          break;
        store<u64>(dst, block);
        srcStart += 8;
        dst += 8;
      }
    } else {
      while (srcStart <= srcEnd8Fast) {
        const block = load<u64>(srcStart);
        if ((block & 0xff00_ff00_ff00_ff00) != 0) break;
        const lo = block & 0x00ff_00ff_00ff_00ff;
        const asciiMask =
          ((lo - 0x0020_0020_0020_0020) |
            ((lo ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
            ((lo ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
          (0x0080_0080_0080_0080 & ~lo);
        if (asciiMask != 0) break;
        store<u64>(dst, block);
        srcStart += 8;
        dst += 8;
      }
    }
    if (srcStart <= srcEnd8Fast) break;

    while (srcStart <= srcEnd - 2) {
      const code = load<u16>(srcStart);
      if (
        (code >= 0xd800 && code <= 0xdfff) ||
        code == BACK_SLASH ||
        code == QUOTE ||
        code < 32
      )
        break;
      store<u16>(dst, code);
      srcStart += 2;
      dst += 2;
    }
    if (srcStart <= srcEnd - 2) break;

    store<u16>(dstStart, QUOTE);
    store<u16>(dst, QUOTE);
    bs.offset = dst + 2;
    return;
  } while (false);

  srcStart = srcInitial;
  const srcEnd8 = srcEnd - 8;

  store<u16>(bs.offset, 34); // "
  bs.offset += 2;

  while (srcStart < srcEnd8) {
    const block = load<u64>(srcStart);
    let mask = detect_escapable_u64_swar_safe(block);
    store<u64>(bs.offset, block);

    if (mask === 0) {
      srcStart += 8;
      bs.offset += 8;
      continue;
    }

    const maxGrowth = <u32>popcnt(mask) * 10;
    bs.prepareGrowth(maxGrowth, maxGrowth + 24);

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      const srcIdx = srcStart + laneIdx;
      // Even (0 2 4 6) -> Possible ASCII escape
      // Odd (1 3 5 7) -> Possibly a Unicode code unit or surrogate
      if ((laneIdx & 1) === 0) {
        mask &= mask - 1;
        const code = load<u16>(srcIdx);
        // The byte mask is conservative: a non-ASCII code unit can also set
        // this bit. Only actual JSON escapes may index the ASCII escape table.
        if (code >= 32 && code != 34 && code != BACK_SLASH) continue;
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));

        if ((escaped & 0xffff) != BACK_SLASH) {
          bs.addSize(10);
          // The block reservation above covers this optimistic u64 suffix
          // copy beyond the logical escape expansion.
          const dstIdx = bs.offset + laneIdx;
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, escaped, 8);
          store<u64>(dstIdx, load<u64>(srcIdx, 2), 12);
          bs.offset += 10;
        } else {
          bs.addSize(2);
          const dstIdx = bs.offset + laneIdx;
          store<u32>(dstIdx, escaped);
          store<u64>(dstIdx, load<u64>(srcIdx, 2), 4);
          bs.offset += 2;
        }
        continue;
      }
      mask &= mask - 1;

      const code = load<u16>(srcIdx - 1);
      if (code < 0xd800 || code > 0xdfff) continue;

      if (code <= 0xdbff && srcIdx + 2 < srcEnd) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          // paired surrogate
          // If the low surrogate is in the next block, copy and consume it
          // now so the next iteration cannot treat it as an unpaired unit.
          if (laneIdx == 7) {
            store<u16>(bs.offset + 8, next);
            srcStart += 2;
            bs.offset += 2;
          }
          // mask &= ~(0xFF << ((laneIdx+2) << 3));
          mask &= mask - 1;
          continue;
        }
      }

      bs.addSize(10);

      // unpaired high/low surrogate
      const dstIdx = bs.offset + laneIdx - 1;
      store<u32>(dstIdx, U_MARKER); // \u
      store<u64>(dstIdx, u16_to_hex4_swar(code), 4);
      store<u64>(dstIdx, load<u64>(srcIdx, 1), 12);
      bs.offset += 10;
    } while (mask !== 0);

    srcStart += 8;
    bs.offset += 8;
  }

  while (srcStart <= srcEnd - 2) {
    const code = load<u16>(srcStart);

    if (code == BACK_SLASH || code == QUOTE || code < 32) {
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

    if (code < 0xd800 || code > 0xdfff) {
      store<u16>(bs.offset, code);
      bs.offset += 2;
      srcStart += 2;
      continue;
    }

    if (code <= 0xdbff && srcStart + 2 <= srcEnd - 2) {
      const next = load<u16>(srcStart, 2);
      if (next >= 0xdc00 && next <= 0xdfff) {
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
}

function write_u_escape(code: u16): void {
  bs.growSize(10);
  store<u32>(bs.offset, U_MARKER); // "\u"
  store<u64>(bs.offset, u16_to_hex4_swar(code), 4);
  bs.offset += 12;
}

export function detect_escapable_u64_swar_safe(block: u64): u64 {
  const hi = block & 0xff00_ff00_ff00_ff00;
  const lo = block & 0x00ff_00ff_00ff_00ff;
  // Setting bit 8 of each 16-bit lane (high byte LSB) prevents borrow from a
  // low byte underflow from propagating across lane boundaries into the next lane.
  const loSafe = lo | 0x0100_0100_0100_0100;
  const ascii_mask =
    ((loSafe - 0x0020_0020_0020_0020) |
      ((loSafe ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
      ((loSafe ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
    (0x0080_0080_0080_0080 & ~lo);
  if (hi == 0) return ascii_mask;
  const hi_mask =
    ((block - 0x0100_0100_0100_0100) & ~block & 0x8000_8000_8000_8000) ^
    0x8000_8000_8000_8000;
  return (ascii_mask & (~hi_mask >> 8)) | hi_mask;
}
