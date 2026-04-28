import { JSON } from "../../index.ts";
import { bs } from "../../../lib/as-bs";
import { expect } from "../../__tests__/lib/index.ts";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { serializeString_SIMD } from "../../serialize/simd/string";
import { u16_to_hex4_swar } from "../../util/swar";
import { bench, blackbox } from "../lib/bench.ts";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

// @ts-expect-error: @lazy is a valid decorator
@lazy const U00_MARKER = 13511005048209500;
// @ts-expect-error: @lazy is a valid decorator
@lazy const U_MARKER = 7667804;
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_0022 = i16x8.splat(0x0022);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_005C = i16x8.splat(0x005c);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_0020 = i16x8.splat(0x0020);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_FFD8 = i16x8.splat(i16(0xd7fe));
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_D800 = i16x8.splat(i16(0xd7ff));

function makePlainPayload(targetBytes: i32): string {
  const base = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-+=/., ";
  const repeats = i32(Math.ceil(targetBytes / (base.length << 1)));
  return base.repeat(repeats).slice(0, targetBytes >> 1);
}

function makeEscapedPayload(targetBytes: i32): string {
  const base = 'abcdefgh"ijklmnop\\\\qrstuvwx\nyz\t\b\f\r' + "\u0001" + "\u001f";
  const repeats = i32(Math.ceil(targetBytes / (base.length << 1)));
  return base.repeat(repeats).slice(0, targetBytes >> 1);
}

const plain = makePlainPayload(512 * 1024);
const escaped = makeEscapedPayload(512 * 1024);

// @ts-expect-error: @inline is a valid decorator
@inline function write_u_escape_copyforward(code: u16): void {
  bs.growSize(10);
  store<u32>(bs.offset, U_MARKER);
  store<u64>(bs.offset, u16_to_hex4_swar(code), 4);
  bs.offset += 12;
}

// @ts-expect-error: @inline is a valid decorator
@inline function shortEscapeOrZero(code: u16): u32 {
  if (code == QUOTE) return (<u32>BACK_SLASH) | ((<u32>QUOTE) << 16);
  if (code == BACK_SLASH) return (<u32>BACK_SLASH) | ((<u32>BACK_SLASH) << 16);
  if (code == 8) return (<u32>BACK_SLASH) | ((<u32>98) << 16);
  if (code == 9) return (<u32>BACK_SLASH) | ((<u32>116) << 16);
  if (code == 10) return (<u32>BACK_SLASH) | ((<u32>110) << 16);
  if (code == 12) return (<u32>BACK_SLASH) | ((<u32>102) << 16);
  if (code == 13) return (<u32>BACK_SLASH) | ((<u32>114) << 16);
  return 0;
}

// @ts-expect-error: @inline is a valid decorator
@inline function emitEscapableOrUnicode(code: u16, useShortMap: bool): void {
  if (code == BACK_SLASH || code == QUOTE || code < 32) {
    if (useShortMap) {
      const escapedCode = shortEscapeOrZero(code);
      if (escapedCode != 0) {
        bs.growSize(2);
        store<u32>(bs.offset, escapedCode);
        bs.offset += 4;
        return;
      }
    }

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
    return;
  }

  if (code < 0xd800 || code > 0xdfff) {
    store<u16>(bs.offset, code);
    bs.offset += 2;
    return;
  }

  write_u_escape_copyforward(code);
}

// @ts-expect-error: @inline is a valid decorator
@inline function emitCodeUnitAt(srcStart: usize, srcEnd: usize, useShortMap: bool): usize {
  const code = load<u16>(srcStart);

  if (code == BACK_SLASH || code == QUOTE || code < 32) {
    emitEscapableOrUnicode(code, useShortMap);
    return srcStart + 2;
  }

  if (code < 0xd800 || code > 0xdfff) {
    store<u16>(bs.offset, code);
    bs.offset += 2;
    return srcStart + 2;
  }

  if (code <= 0xdbff && srcStart + 2 <= srcEnd - 2) {
    const next = load<u16>(srcStart, 2);
    if (next >= 0xdc00 && next <= 0xdfff) {
      store<u16>(bs.offset, code);
      store<u16>(bs.offset + 2, next);
      bs.offset += 4;
      return srcStart + 4;
    }
  }

  write_u_escape_copyforward(code);
  return srcStart + 2;
}

function serializeString_SIMD_FirstHit(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd16 = srcEnd - 16;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));
    const mask = i8x16.bitmask(sieve);

    if (mask == 0) {
      store<v128>(bs.offset, block);
      bs.offset += 16;
      srcStart += 16;
      continue;
    }

    const laneIdx = ctz(mask);
    const prefixBytes = laneIdx & ~1;
    if (prefixBytes != 0) {
      memory.copy(bs.offset, srcStart, prefixBytes);
      bs.offset += prefixBytes;
      srcStart += prefixBytes;
    }
    srcStart = emitCodeUnitAt(srcStart, srcEnd, false);
  }

  while (srcStart <= srcEnd - 2) {
    srcStart = emitCodeUnitAt(srcStart, srcEnd, false);
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SIMD_FirstHitPregrow(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd16 = srcEnd - 16;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));
    const mask = i8x16.bitmask(sieve);

    if (mask == 0) {
      store<v128>(bs.offset, block);
      bs.offset += 16;
      srcStart += 16;
      continue;
    }

    bs.growSize(26);
    const laneIdx = ctz(mask);
    const prefixBytes = laneIdx & ~1;
    if (prefixBytes != 0) {
      memory.copy(bs.offset, srcStart, prefixBytes);
      bs.offset += prefixBytes;
      srcStart += prefixBytes;
    }
    srcStart = emitCodeUnitAt(srcStart, srcEnd, false);
  }

  while (srcStart <= srcEnd - 2) {
    srcStart = emitCodeUnitAt(srcStart, srcEnd, false);
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SIMD_FirstHitShortMap(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd16 = srcEnd - 16;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));
    const mask = i8x16.bitmask(sieve);

    if (mask == 0) {
      store<v128>(bs.offset, block);
      bs.offset += 16;
      srcStart += 16;
      continue;
    }

    bs.growSize(26);
    const laneIdx = ctz(mask);
    const prefixBytes = laneIdx & ~1;
    if (prefixBytes != 0) {
      memory.copy(bs.offset, srcStart, prefixBytes);
      bs.offset += prefixBytes;
      srcStart += prefixBytes;
    }
    srcStart = emitCodeUnitAt(srcStart, srcEnd, true);
  }

  while (srcStart <= srcEnd - 2) {
    srcStart = emitCodeUnitAt(srcStart, srcEnd, true);
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SIMD_DenseScalar(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd16 = srcEnd - 16;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));
    let mask = i8x16.bitmask(sieve);

    if (mask == 0) {
      store<v128>(bs.offset, block);
      bs.offset += 16;
      srcStart += 16;
      continue;
    }

    if (popcnt(mask) >= 2) {
      const blockEnd = srcStart + 16;
      while (srcStart < blockEnd) {
        srcStart = emitCodeUnitAt(srcStart, srcEnd, false);
      }
      continue;
    }

    do {
      const laneIdx = ctz(mask);
      const srcIdx = srcStart + laneIdx;
      mask &= mask - 1;

      if ((laneIdx & 1) === 0) {
        const code = load<u16>(srcIdx);
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
        const dstIdx = bs.offset + laneIdx;

        if ((escaped & 0xffff) != BACK_SLASH) {
          bs.growSize(10);
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, escaped, 8);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 12);
          bs.offset += 10;
        } else {
          bs.growSize(2);
          store<u32>(dstIdx, escaped);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 4);
          bs.offset += 2;
        }
        continue;
      }

      const code = load<u16>(srcIdx - 1);
      if (code < 0xd800 || code > 0xdfff) continue;

      if (code <= 0xdbff && srcIdx + 1 <= srcEnd - 2) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          mask &= ~(0b11 << (laneIdx + 1));
          continue;
        }
      }

      bs.growSize(10);
      const dstIdx = bs.offset + laneIdx - 1;
      store<u32>(dstIdx, U_MARKER);
      store<u64>(dstIdx, u16_to_hex4_swar(code), 4);
      store<v128>(dstIdx, load<v128>(srcIdx, 1), 12);
      bs.offset += 10;
    } while (mask !== 0);

    srcStart += 16;
    bs.offset += 16;
  }

  while (srcStart <= srcEnd - 2) {
    srcStart = emitCodeUnitAt(srcStart, srcEnd, false);
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SIMD_DenseScalarShortMap(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd16 = srcEnd - 16;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));
    let mask = i8x16.bitmask(sieve);

    if (mask == 0) {
      store<v128>(bs.offset, block);
      bs.offset += 16;
      srcStart += 16;
      continue;
    }

    if (popcnt(mask) >= 2) {
      const blockEnd = srcStart + 16;
      while (srcStart < blockEnd) {
        srcStart = emitCodeUnitAt(srcStart, srcEnd, true);
      }
      continue;
    }

    do {
      const laneIdx = ctz(mask);
      const srcIdx = srcStart + laneIdx;
      mask &= mask - 1;

      if ((laneIdx & 1) === 0) {
        const code = load<u16>(srcIdx);
        const escaped = shortEscapeOrZero(code);
        const dstIdx = bs.offset + laneIdx;

        if (escaped != 0) {
          bs.growSize(2);
          store<u32>(dstIdx, escaped);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 4);
          bs.offset += 2;
        } else {
          bs.growSize(10);
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2)), 8);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 12);
          bs.offset += 10;
        }
        continue;
      }

      const code = load<u16>(srcIdx - 1);
      if (code < 0xd800 || code > 0xdfff) continue;

      if (code <= 0xdbff && srcIdx + 1 <= srcEnd - 2) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          mask &= ~(0b11 << (laneIdx + 1));
          continue;
        }
      }

      bs.growSize(10);
      const dstIdx = bs.offset + laneIdx - 1;
      store<u32>(dstIdx, U_MARKER);
      store<u64>(dstIdx, u16_to_hex4_swar(code), 4);
      store<v128>(dstIdx, load<v128>(srcIdx, 1), 12);
      bs.offset += 10;
    } while (mask !== 0);

    srcStart += 16;
    bs.offset += 16;
  }

  while (srcStart <= srcEnd - 2) {
    srcStart = emitCodeUnitAt(srcStart, srcEnd, true);
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SIMD_RunCopy(src: string): void {
  const srcBase = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcBase - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcBase + srcSize;
  const srcEnd16 = srcEnd - 16;
  let runStart = srcBase;
  let scan = srcBase;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (scan < srcEnd16) {
    const block = load<v128>(scan);
    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));
    const mask = i8x16.bitmask(sieve);

    if (mask == 0) {
      scan += 16;
      continue;
    }

    const hit = scan + (ctz(mask) & ~1);
    const runBytes = i32(hit - runStart);
    if (runBytes != 0) {
      bs.growSize(runBytes + 12);
      memory.copy(bs.offset, runStart, runBytes);
      bs.offset += runBytes;
    }

    runStart = emitCodeUnitAt(hit, srcEnd, false);
    scan = runStart;
  }

  const pendingBytes = i32(scan - runStart);
  if (pendingBytes != 0) {
    bs.growSize(pendingBytes);
    memory.copy(bs.offset, runStart, pendingBytes);
    bs.offset += pendingBytes;
  }

  while (scan <= srcEnd - 2) {
    scan = emitCodeUnitAt(scan, srcEnd, false);
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SIMD_RunCopyShortMap(src: string): void {
  const srcBase = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcBase - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcBase + srcSize;
  const srcEnd16 = srcEnd - 16;
  let runStart = srcBase;
  let scan = srcBase;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (scan < srcEnd16) {
    const block = load<v128>(scan);
    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));
    const mask = i8x16.bitmask(sieve);

    if (mask == 0) {
      scan += 16;
      continue;
    }

    const hit = scan + (ctz(mask) & ~1);
    const runBytes = i32(hit - runStart);
    if (runBytes != 0) {
      bs.growSize(runBytes + 12);
      memory.copy(bs.offset, runStart, runBytes);
      bs.offset += runBytes;
    }

    runStart = emitCodeUnitAt(hit, srcEnd, true);
    scan = runStart;
  }

  const pendingBytes = i32(scan - runStart);
  if (pendingBytes != 0) {
    bs.growSize(pendingBytes);
    memory.copy(bs.offset, runStart, pendingBytes);
    bs.offset += pendingBytes;
  }

  while (scan <= srcEnd - 2) {
    scan = emitCodeUnitAt(scan, srcEnd, true);
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SIMD_CurrentPregrow(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd16 = srcEnd - 16;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    store<v128>(bs.offset, block);

    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));

    if (!v128.any_true(sieve)) {
      bs.offset += 16;
      srcStart += 16;
      continue;
    }

    let mask = i8x16.bitmask(sieve);
    bs.growSize(popcnt(mask) * 10 + 12);

    do {
      const laneIdx = ctz(mask);
      const srcIdx = srcStart + laneIdx;
      mask &= mask - 1;

      if ((laneIdx & 1) === 0) {
        const code = load<u16>(srcIdx);
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
        const dstIdx = bs.offset + laneIdx;

        if ((escaped & 0xffff) != BACK_SLASH) {
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, escaped, 8);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 12);
          bs.offset += 10;
        } else {
          store<u32>(dstIdx, escaped);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 4);
          bs.offset += 2;
        }
        continue;
      }

      const code = load<u16>(srcIdx - 1);
      if (code < 0xd800 || code > 0xdfff) continue;

      if (code <= 0xdbff && srcIdx + 1 <= srcEnd - 2) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          mask &= mask - 1;
          continue;
        }
      }

      const dstIdx = bs.offset + laneIdx - 1;
      store<u32>(dstIdx, U_MARKER);
      store<u64>(dstIdx, u16_to_hex4_swar(code), 4);
      store<v128>(dstIdx, load<v128>(srcIdx, 1), 12);
      bs.offset += 10;
    } while (mask !== 0);

    srcStart += 16;
    bs.offset += 16;
  }

  while (srcStart <= srcEnd - 2) {
    srcStart = emitCodeUnitAt(srcStart, srcEnd, false);
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SIMD_ShortMap(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd16 = srcEnd - 16;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    store<v128>(bs.offset, block);

    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));

    if (!v128.any_true(sieve)) {
      bs.offset += 16;
      srcStart += 16;
      continue;
    }

    let mask = i8x16.bitmask(sieve);

    do {
      const laneIdx = ctz(mask);
      const srcIdx = srcStart + laneIdx;
      mask &= mask - 1;

      if ((laneIdx & 1) === 0) {
        const code = load<u16>(srcIdx);
        const escaped = shortEscapeOrZero(code);
        const dstIdx = bs.offset + laneIdx;

        if (escaped != 0) {
          bs.growSize(2);
          store<u32>(dstIdx, escaped);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 4);
          bs.offset += 2;
        } else {
          bs.growSize(10);
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2)), 8);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 12);
          bs.offset += 10;
        }
        continue;
      }

      const code = load<u16>(srcIdx - 1);
      if (code < 0xd800 || code > 0xdfff) continue;

      if (code <= 0xdbff && srcIdx + 1 <= srcEnd - 2) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          mask &= mask - 1;
          continue;
        }
      }

      bs.growSize(10);
      const dstIdx = bs.offset + laneIdx - 1;
      store<u32>(dstIdx, U_MARKER);
      store<u64>(dstIdx, u16_to_hex4_swar(code), 4);
      store<v128>(dstIdx, load<v128>(srcIdx, 1), 12);
      bs.offset += 10;
    } while (mask !== 0);

    srcStart += 16;
    bs.offset += 16;
  }

  while (srcStart <= srcEnd - 2) {
    const code = load<u16>(srcStart);
    if (code == BACK_SLASH || code == QUOTE || code < 32) {
      const escapedCode = shortEscapeOrZero(code);
      if (escapedCode != 0) {
        bs.growSize(2);
        store<u32>(bs.offset, escapedCode);
        bs.offset += 4;
      } else {
        bs.growSize(10);
        store<u64>(bs.offset, U00_MARKER);
        store<u32>(bs.offset, load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2)), 8);
        bs.offset += 12;
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
        store<u16>(bs.offset, code);
        store<u16>(bs.offset + 2, next);
        bs.offset += 4;
        srcStart += 4;
        continue;
      }
    }

    write_u_escape_copyforward(code);
    srcStart += 2;
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SIMD_LaneSurrogate(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd16 = srcEnd - 16;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    store<v128>(bs.offset, block);

    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i16x8.gt_u(block, SPLAT_D800);
    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));

    if (!v128.any_true(sieve)) {
      bs.offset += 16;
      srcStart += 16;
      continue;
    }

    let mask = i8x16.bitmask(sieve);

    do {
      const laneIdx = ctz(mask);
      const srcIdx = srcStart + laneIdx;
      mask &= mask - 1;

      if ((laneIdx & 1) === 0) {
        const code = load<u16>(srcIdx);
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
        const dstIdx = bs.offset + laneIdx;

        if ((escaped & 0xffff) != BACK_SLASH) {
          bs.growSize(10);
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, escaped, 8);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 12);
          bs.offset += 10;
        } else {
          bs.growSize(2);
          store<u32>(dstIdx, escaped);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 4);
          bs.offset += 2;
        }
        continue;
      }

      const code = load<u16>(srcIdx - 1);
      if (code < 0xd800 || code > 0xdfff) continue;

      if (code <= 0xdbff && srcIdx + 1 <= srcEnd - 2) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          mask &= ~(0b11 << (laneIdx + 1));
          continue;
        }
      }

      bs.growSize(10);
      const dstIdx = bs.offset + laneIdx - 1;
      store<u32>(dstIdx, U_MARKER);
      store<u64>(dstIdx, u16_to_hex4_swar(code), 4);
      store<v128>(dstIdx, load<v128>(srcIdx, 1), 12);
      bs.offset += 10;
    } while (mask !== 0);

    srcStart += 16;
    bs.offset += 16;
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
        store<u16>(bs.offset, code);
        store<u16>(bs.offset + 2, next);
        bs.offset += 4;
        srcStart += 4;
        continue;
      }
    }

    write_u_escape_copyforward(code);
    srcStart += 2;
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SIMD_MaskOnce(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd16 = srcEnd - 16;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    store<v128>(bs.offset, block);

    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));
    let mask = i8x16.bitmask(sieve);

    if (mask == 0) {
      bs.offset += 16;
      srcStart += 16;
      continue;
    }

    do {
      const laneIdx = ctz(mask);
      const srcIdx = srcStart + laneIdx;
      mask &= mask - 1;

      if ((laneIdx & 1) === 0) {
        const code = load<u16>(srcIdx);
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
        const dstIdx = bs.offset + laneIdx;

        if ((escaped & 0xffff) != BACK_SLASH) {
          bs.growSize(10);
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, escaped, 8);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 12);
          bs.offset += 10;
        } else {
          bs.growSize(2);
          store<u32>(dstIdx, escaped);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 4);
          bs.offset += 2;
        }
        continue;
      }

      const code = load<u16>(srcIdx - 1);
      if (code < 0xd800 || code > 0xdfff) continue;

      if (code <= 0xdbff && srcIdx + 1 <= srcEnd - 2) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          mask &= ~(0b11 << (laneIdx + 1));
          continue;
        }
      }

      bs.growSize(10);
      const dstIdx = bs.offset + laneIdx - 1;
      store<u32>(dstIdx, U_MARKER);
      store<u64>(dstIdx, u16_to_hex4_swar(code), 4);
      store<v128>(dstIdx, load<v128>(srcIdx, 1), 12);
      bs.offset += 10;
    } while (mask !== 0);

    srcStart += 16;
    bs.offset += 16;
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
        store<u16>(bs.offset, code);
        store<u16>(bs.offset + 2, next);
        bs.offset += 4;
        srcStart += 4;
        continue;
      }
    }

    write_u_escape_copyforward(code);
    srcStart += 2;
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SIMD_MaskCombine(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd16 = srcEnd - 16;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    store<v128>(bs.offset, block);

    let mask =
      i8x16.bitmask(i16x8.eq(block, SPLAT_0022)) |
      i8x16.bitmask(i16x8.eq(block, SPLAT_005C)) |
      i8x16.bitmask(i16x8.lt_u(block, SPLAT_0020)) |
      i8x16.bitmask(i8x16.gt_u(block, SPLAT_FFD8));

    if (mask == 0) {
      bs.offset += 16;
      srcStart += 16;
      continue;
    }

    do {
      const laneIdx = ctz(mask);
      const srcIdx = srcStart + laneIdx;
      mask &= mask - 1;

      if ((laneIdx & 1) === 0) {
        const code = load<u16>(srcIdx);
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
        const dstIdx = bs.offset + laneIdx;

        if ((escaped & 0xffff) != BACK_SLASH) {
          bs.growSize(10);
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, escaped, 8);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 12);
          bs.offset += 10;
        } else {
          bs.growSize(2);
          store<u32>(dstIdx, escaped);
          store<v128>(dstIdx, load<v128>(srcIdx, 2), 4);
          bs.offset += 2;
        }
        continue;
      }

      const code = load<u16>(srcIdx - 1);
      if (code < 0xd800 || code > 0xdfff) continue;

      if (code <= 0xdbff && srcIdx + 1 <= srcEnd - 2) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          mask &= ~(0b11 << (laneIdx + 1));
          continue;
        }
      }

      bs.growSize(10);
      const dstIdx = bs.offset + laneIdx - 1;
      store<u32>(dstIdx, U_MARKER);
      store<u64>(dstIdx, u16_to_hex4_swar(code), 4);
      store<v128>(dstIdx, load<v128>(srcIdx, 1), 12);
      bs.offset += 10;
    } while (mask !== 0);

    srcStart += 16;
    bs.offset += 16;
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
        store<u16>(bs.offset, code);
        store<u16>(bs.offset + 2, next);
        bs.offset += 4;
        srcStart += 4;
        continue;
      }
    }

    write_u_escape_copyforward(code);
    srcStart += 2;
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SIMD_PlainFastpath(src: string): void {
  const srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd16 = srcEnd - 16;
  let ptr = srcStart;

  while (ptr < srcEnd16) {
    const block = load<v128>(ptr);
    const eq22 = i16x8.eq(block, SPLAT_0022);
    const eq5C = i16x8.eq(block, SPLAT_005C);
    const lt20 = i16x8.lt_u(block, SPLAT_0020);
    const gteD8 = i8x16.gt_u(block, SPLAT_FFD8);
    const sieve = v128.or(eq22, v128.or(eq5C, v128.or(lt20, gteD8)));
    if (v128.any_true(sieve)) {
      serializeString_SIMD(src);
      return;
    }
    ptr += 16;
  }

  while (ptr <= srcEnd - 2) {
    const code = load<u16>(ptr);
    if (code == BACK_SLASH || code == QUOTE || code < 32 || code >= 0xd800) {
      serializeString_SIMD(src);
      return;
    }
    ptr += 2;
  }

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
  memory.copy(bs.offset, srcStart, srcSize);
  bs.offset += srcSize;
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeCurrent(src: string): string {
  serializeString_SIMD(src);
  return bs.out<string>();
}

function serializeShortMap(src: string): string {
  serializeString_SIMD_ShortMap(src);
  return bs.out<string>();
}

function serializeLaneSurrogate(src: string): string {
  serializeString_SIMD_LaneSurrogate(src);
  return bs.out<string>();
}

function serializePlainFastpath(src: string): string {
  serializeString_SIMD_PlainFastpath(src);
  return bs.out<string>();
}

function serializeMaskOnce(src: string): string {
  serializeString_SIMD_MaskOnce(src);
  return bs.out<string>();
}

function serializeMaskCombine(src: string): string {
  serializeString_SIMD_MaskCombine(src);
  return bs.out<string>();
}

function serializeFirstHit(src: string): string {
  serializeString_SIMD_FirstHit(src);
  return bs.out<string>();
}

function serializeFirstHitPregrow(src: string): string {
  serializeString_SIMD_FirstHitPregrow(src);
  return bs.out<string>();
}

function serializeFirstHitShortMap(src: string): string {
  serializeString_SIMD_FirstHitShortMap(src);
  return bs.out<string>();
}

function serializeDenseScalar(src: string): string {
  serializeString_SIMD_DenseScalar(src);
  return bs.out<string>();
}

function serializeDenseScalarShortMap(src: string): string {
  serializeString_SIMD_DenseScalarShortMap(src);
  return bs.out<string>();
}

function serializeRunCopy(src: string): string {
  serializeString_SIMD_RunCopy(src);
  return bs.out<string>();
}

function serializeRunCopyShortMap(src: string): string {
  serializeString_SIMD_RunCopyShortMap(src);
  return bs.out<string>();
}

function serializeCurrentPregrow(src: string): string {
  serializeString_SIMD_CurrentPregrow(src);
  return bs.out<string>();
}

const expectedPlain: string = JSON.stringify(plain);
const expectedEscaped: string = JSON.stringify(escaped);

expect(serializeCurrent(plain)).toBe(expectedPlain);
expect(serializeShortMap(plain)).toBe(expectedPlain);
expect(serializeLaneSurrogate(plain)).toBe(expectedPlain);
expect(serializePlainFastpath(plain)).toBe(expectedPlain);
expect(serializeMaskOnce(plain)).toBe(expectedPlain);
expect(serializeMaskCombine(plain)).toBe(expectedPlain);
expect(serializeFirstHit(plain)).toBe(expectedPlain);
expect(serializeFirstHitPregrow(plain)).toBe(expectedPlain);
expect(serializeFirstHitShortMap(plain)).toBe(expectedPlain);
expect(serializeDenseScalar(plain)).toBe(expectedPlain);
expect(serializeDenseScalarShortMap(plain)).toBe(expectedPlain);
expect(serializeRunCopy(plain)).toBe(expectedPlain);
expect(serializeRunCopyShortMap(plain)).toBe(expectedPlain);
expect(serializeCurrentPregrow(plain)).toBe(expectedPlain);
expect(serializeCurrent(escaped)).toBe(expectedEscaped);
expect(serializeShortMap(escaped)).toBe(expectedEscaped);
expect(serializeLaneSurrogate(escaped)).toBe(expectedEscaped);
expect(serializePlainFastpath(escaped)).toBe(expectedEscaped);
expect(serializeMaskOnce(escaped)).toBe(expectedEscaped);
expect(serializeMaskCombine(escaped)).toBe(expectedEscaped);
expect(serializeFirstHit(escaped)).toBe(expectedEscaped);
expect(serializeFirstHitPregrow(escaped)).toBe(expectedEscaped);
expect(serializeFirstHitShortMap(escaped)).toBe(expectedEscaped);
expect(serializeDenseScalar(escaped)).toBe(expectedEscaped);
expect(serializeDenseScalarShortMap(escaped)).toBe(expectedEscaped);
expect(serializeRunCopy(escaped)).toBe(expectedEscaped);
expect(serializeRunCopyShortMap(escaped)).toBe(expectedEscaped);
expect(serializeCurrentPregrow(escaped)).toBe(expectedEscaped);

bench("Serialize String SIMD plain (current)", () => blackbox(serializeCurrent(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (short-map)", () => blackbox(serializeShortMap(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (lane-surrogate)", () => blackbox(serializeLaneSurrogate(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (plain-fastpath)", () => blackbox(serializePlainFastpath(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (mask-once)", () => blackbox(serializeMaskOnce(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (mask-combine)", () => blackbox(serializeMaskCombine(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (first-hit)", () => blackbox(serializeFirstHit(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (first-hit-pregrow)", () => blackbox(serializeFirstHitPregrow(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (first-hit-shortmap)", () => blackbox(serializeFirstHitShortMap(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (dense-scalar)", () => blackbox(serializeDenseScalar(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (dense-scalar-shortmap)", () => blackbox(serializeDenseScalarShortMap(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (run-copy)", () => blackbox(serializeRunCopy(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (run-copy-shortmap)", () => blackbox(serializeRunCopyShortMap(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD plain (current-pregrow)", () => blackbox(serializeCurrentPregrow(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SIMD escaped (current)", () => blackbox(serializeCurrent(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (short-map)", () => blackbox(serializeShortMap(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (lane-surrogate)", () => blackbox(serializeLaneSurrogate(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (plain-fastpath)", () => blackbox(serializePlainFastpath(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (mask-once)", () => blackbox(serializeMaskOnce(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (mask-combine)", () => blackbox(serializeMaskCombine(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (first-hit)", () => blackbox(serializeFirstHit(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (first-hit-pregrow)", () => blackbox(serializeFirstHitPregrow(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (first-hit-shortmap)", () => blackbox(serializeFirstHitShortMap(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (dense-scalar)", () => blackbox(serializeDenseScalar(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (dense-scalar-shortmap)", () => blackbox(serializeDenseScalarShortMap(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (run-copy)", () => blackbox(serializeRunCopy(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (run-copy-shortmap)", () => blackbox(serializeRunCopyShortMap(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SIMD escaped (current-pregrow)", () => blackbox(serializeCurrentPregrow(escaped)), 4_000, expectedEscaped.length << 1);
