import { JSON } from "..";
import { bs } from "../../lib/as-bs";
import { expect } from "../__tests__/lib";
import { BACK_SLASH, QUOTE } from "../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../globals/tables";
import { serializeString_SWAR, detect_escapable_u64_swar_safe, detect_escapable_u64_swar_unsafe } from "../serialize/swar/string";
import { u16_to_hex4_swar } from "../util/swar";
import { bench, blackbox } from "./lib/bench";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

// @ts-expect-error: @lazy is a valid decorator
@lazy const U00_MARKER = 13511005048209500;
// @ts-expect-error: @lazy is a valid decorator
@lazy const U_MARKER = 7667804;

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

function serializeString_SWAR_PrefixScan(src: string): void {
  const originalStart = changetype<usize>(src);
  let srcStart = originalStart;
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd8 = srcEnd - 8;

  let prefixEnd = srcStart;

  while (prefixEnd < srcEnd8) {
    if (detect_escapable_u64_swar_safe(load<u64>(prefixEnd)) !== 0) break;
    prefixEnd += 8;
  }

  while (prefixEnd <= srcEnd - 2) {
    const code = load<u16>(prefixEnd);
    if (code == BACK_SLASH || code == QUOTE || code < 32 || code > 0x7f) break;
    prefixEnd += 2;
  }

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  if (prefixEnd == srcEnd) {
    memory.copy(bs.offset, srcStart, srcSize);
    bs.offset += srcSize;
    store<u16>(bs.offset, QUOTE);
    bs.offset += 2;
    return;
  }

  if (prefixEnd != srcStart) {
    const prefixBytes = prefixEnd - srcStart;
    memory.copy(bs.offset, srcStart, prefixBytes);
    bs.offset += prefixBytes;
    srcStart = prefixEnd;
  }

  while (srcStart < srcEnd8) {
    const block = load<u64>(srcStart);
    store<u64>(bs.offset, block);

    let mask = detect_escapable_u64_swar_safe(block);
    if (mask === 0) {
      srcStart += 8;
      bs.offset += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      const srcIdx = srcStart + laneIdx;

      if ((laneIdx & 1) === 0) {
        mask &= ~(0xffff << (laneIdx << 3));
        const code = load<u16>(srcIdx);
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
        const dstIdx = bs.offset + laneIdx;

        if ((escaped & 0xffff) != BACK_SLASH) {
          bs.growSize(10);
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, escaped, 8);
          store<u64>(dstIdx, load<u64>(srcIdx, 2), 12);
          bs.offset += 10;
        } else {
          bs.growSize(2);
          store<u32>(dstIdx, escaped);
          store<u64>(dstIdx, load<u64>(srcIdx, 2), 4);
          bs.offset += 2;
        }
        continue;
      }

      mask &= ~(0xffff << (laneIdx << 3));

      const code = load<u16>(srcIdx - 1);
      if (code < 0xd800 || code > 0xdfff) continue;

      if (code <= 0xdbff && srcIdx + 2 < srcEnd) {
        const next = load<u16>(srcIdx, 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          mask &= ~(0xff << ((laneIdx + 2) << 3));
          continue;
        }
      }

      bs.growSize(10);
      const dstIdx = bs.offset + laneIdx - 1;
      store<u32>(dstIdx, U_MARKER);
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
      const escapedCode = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
      if ((escapedCode & 0xffff) != BACK_SLASH) {
        bs.growSize(10);
        store<u64>(bs.offset, U00_MARKER);
        store<u32>(bs.offset, escapedCode, 8);
        bs.offset += 12;
      } else {
        bs.growSize(2);
        store<u32>(bs.offset, escapedCode);
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

function serializeString_SWAR_PlainFastpath(src: string): void {
  const srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd8 = srcEnd - 8;
  let ptr = srcStart;

  while (ptr < srcEnd8) {
    if (detect_escapable_u64_swar_safe(load<u64>(ptr)) !== 0) {
      serializeString_SWAR(src);
      return;
    }
    ptr += 8;
  }

  while (ptr <= srcEnd - 2) {
    const code = load<u16>(ptr);
    if (code == BACK_SLASH || code == QUOTE || code < 32 || code > 0x7f) {
      serializeString_SWAR(src);
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

function serializeString_SWAR_UnsafeDetect(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd8 = srcEnd - 8;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd8) {
    const block = load<u64>(srcStart);
    store<u64>(bs.offset, block);

    let mask = detect_escapable_u64_swar_unsafe(block);
    if (mask === 0) {
      srcStart += 8;
      bs.offset += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      const srcIdx = srcStart + laneIdx;

      if ((laneIdx & 1) === 0) {
        mask &= mask - 1;
        const code = load<u16>(srcIdx);
        if (code > 0x7f) continue;
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
        const dstIdx = bs.offset + laneIdx;

        if ((escaped & 0xffff) == BACK_SLASH) {
          bs.growSize(2);
          store<u32>(dstIdx, escaped);
          store<u64>(dstIdx, load<u64>(srcIdx, 2), 4);
          bs.offset += 2;
        } else {
          bs.growSize(10);
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, escaped, 8);
          store<u64>(dstIdx, load<u64>(srcIdx, 2), 12);
          bs.offset += 10;
        }
        continue;
      }

      mask &= ~(0xff << (laneIdx << 3));

      const code = load<u16>(srcIdx - 1);
      if (code < 0xd800 || code > 0xdfff) continue;

      if (code <= 0xdbff && srcIdx + 2 < srcEnd) {
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
      if ((escaped & 0xffff) == BACK_SLASH) {
        bs.growSize(2);
        store<u32>(bs.offset, escaped);
        bs.offset += 4;
      } else {
        bs.growSize(10);
        store<u64>(bs.offset, U00_MARKER);
        store<u32>(bs.offset, escaped, 8);
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

function serializeString_SWAR_UnsafePlainFastpath(src: string): void {
  const srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd8 = srcEnd - 8;
  let ptr = srcStart;

  while (ptr < srcEnd8) {
    if (detect_escapable_u64_swar_safe(load<u64>(ptr)) !== 0) {
      serializeString_SWAR_UnsafeDetect(src);
      return;
    }
    ptr += 8;
  }

  while (ptr <= srcEnd - 2) {
    const code = load<u16>(ptr);
    if (code == BACK_SLASH || code == QUOTE || code < 32 || code > 0x7f) {
      serializeString_SWAR_UnsafeDetect(src);
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
  serializeString_SWAR(src);
  return bs.out<string>();
}

function serializePrefixScan(src: string): string {
  serializeString_SWAR_PrefixScan(src);
  return bs.out<string>();
}

function serializePlainFastpath(src: string): string {
  serializeString_SWAR_PlainFastpath(src);
  return bs.out<string>();
}

function serializeUnsafeDetect(src: string): string {
  serializeString_SWAR_UnsafeDetect(src);
  return bs.out<string>();
}

function serializeUnsafePlainFastpath(src: string): string {
  serializeString_SWAR_UnsafePlainFastpath(src);
  return bs.out<string>();
}

const expectedPlain: string = JSON.stringify(plain);
const expectedEscaped: string = JSON.stringify(escaped);

expect(serializeCurrent(plain)).toBe(expectedPlain);
expect(serializePrefixScan(plain)).toBe(expectedPlain);
expect(serializePlainFastpath(plain)).toBe(expectedPlain);
expect(serializeUnsafeDetect(plain)).toBe(expectedPlain);
expect(serializeUnsafePlainFastpath(plain)).toBe(expectedPlain);
expect(serializeCurrent(escaped)).toBe(expectedEscaped);
expect(serializePrefixScan(escaped)).toBe(expectedEscaped);
expect(serializePlainFastpath(escaped)).toBe(expectedEscaped);
expect(serializeUnsafeDetect(escaped)).toBe(expectedEscaped);
expect(serializeUnsafePlainFastpath(escaped)).toBe(expectedEscaped);

bench("Serialize String SWAR plain (current)", () => blackbox(serializeCurrent(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SWAR plain (prefix-scan)", () => blackbox(serializePrefixScan(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SWAR plain (plain-fastpath)", () => blackbox(serializePlainFastpath(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SWAR plain (unsafe-detect)", () => blackbox(serializeUnsafeDetect(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SWAR plain (unsafe+plain-fastpath)", () => blackbox(serializeUnsafePlainFastpath(plain)), 4_000, expectedPlain.length << 1);
bench("Serialize String SWAR escaped (current)", () => blackbox(serializeCurrent(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SWAR escaped (prefix-scan)", () => blackbox(serializePrefixScan(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SWAR escaped (plain-fastpath)", () => blackbox(serializePlainFastpath(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SWAR escaped (unsafe-detect)", () => blackbox(serializeUnsafeDetect(escaped)), 4_000, expectedEscaped.length << 1);
bench("Serialize String SWAR escaped (unsafe+plain-fastpath)", () => blackbox(serializeUnsafePlainFastpath(escaped)), 4_000, expectedEscaped.length << 1);
