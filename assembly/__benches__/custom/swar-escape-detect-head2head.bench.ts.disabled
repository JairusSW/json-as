import { JSON } from "..";
import { bs } from "../../lib/as-bs";
import { expect } from "../__tests__/lib";
import { BACK_SLASH, QUOTE } from "../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../globals/tables";
import { serializeString_SWAR, detect_escapable_u64_swar_safe, detect_escapable_u64_swar_unsafe } from "../serialize/swar/string";
import { u16_to_hex4_swar } from "../util/swar";
import { bench, blackbox, dumpToFile } from "./lib/bench";
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

function scanEscapesSafe(src: string): u32 {
  let ptr = changetype<usize>(src);
  const byteLength = changetype<OBJECT>(ptr - TOTAL_OVERHEAD).rtSize;
  const end = ptr + byteLength;
  const end8 = end - 8;
  let hits: u32 = 0;

  while (ptr < end8) {
    const mask = detect_escapable_u64_swar_safe(load<u64>(ptr));
    hits += <u32>popcnt(mask);
    ptr += 8;
  }

  while (ptr < end) {
    const code = load<u16>(ptr);
    if (code == QUOTE || code == BACK_SLASH || code < 32 || code > 0x7f) hits += 1;
    ptr += 2;
  }

  return hits;
}

function scanEscapesUnsafe(src: string): u32 {
  let ptr = changetype<usize>(src);
  const byteLength = changetype<OBJECT>(ptr - TOTAL_OVERHEAD).rtSize;
  const end = ptr + byteLength;
  const end8 = end - 8;
  let hits: u32 = 0;

  while (ptr < end8) {
    const mask = detect_escapable_u64_swar_unsafe(load<u64>(ptr));
    hits += <u32>popcnt(mask);
    ptr += 8;
  }

  while (ptr < end) {
    const code = load<u16>(ptr);
    if (code == QUOTE || code == BACK_SLASH || code < 32 || code > 0x7f) hits += 1;
    ptr += 2;
  }

  return hits;
}

function serializeString_SWAR_SafeClone(src: string): void {
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

function serializeString_SWAR_UnsafeClone(src: string): void {
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

      mask &= mask - 1;

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

function serializeCurrent(src: string): string {
  serializeString_SWAR(src);
  return bs.out<string>();
}

function serializeSafeClone(src: string): string {
  serializeString_SWAR_SafeClone(src);
  return bs.out<string>();
}

function serializeUnsafeClone(src: string): string {
  serializeString_SWAR_UnsafeClone(src);
  return bs.out<string>();
}

const plainExpected: string = JSON.stringify(plain);
const escapedExpected: string = JSON.stringify(escaped);

expect<string>(serializeCurrent(plain)).toBe<string>(plainExpected);
expect<string>(serializeSafeClone(plain)).toBe<string>(plainExpected);
expect<string>(serializeUnsafeClone(plain)).toBe<string>(plainExpected);
expect<string>(serializeCurrent(escaped)).toBe<string>(escapedExpected);
expect<string>(serializeSafeClone(escaped)).toBe<string>(escapedExpected);
expect<string>(serializeUnsafeClone(escaped)).toBe<string>(escapedExpected);

const plainBytes = plain.length << 1;
const escapedBytes = escaped.length << 1;

bench("Escape detect SWAR (safe, plain)", () => blackbox(scanEscapesSafe(plain)), 60_000, plainBytes);
dumpToFile("swar-escape-detect-plain-safe", "scan");

bench("Escape detect SWAR (unsafe, plain)", () => blackbox(scanEscapesUnsafe(plain)), 60_000, plainBytes);
dumpToFile("swar-escape-detect-plain-unsafe", "scan");

bench("Escape detect SWAR (safe, escaped)", () => blackbox(scanEscapesSafe(escaped)), 60_000, escapedBytes);
dumpToFile("swar-escape-detect-escaped-safe", "scan");

bench("Escape detect SWAR (unsafe, escaped)", () => blackbox(scanEscapesUnsafe(escaped)), 60_000, escapedBytes);
dumpToFile("swar-escape-detect-escaped-unsafe", "scan");

bench("Serialize String SWAR (current, plain)", () => blackbox(serializeCurrent(plain)), 4_000, plainExpected.length << 1);
dumpToFile("swar-string-serialize-plain-current", "serialize");

bench("Serialize String SWAR (safe-clone, plain)", () => blackbox(serializeSafeClone(plain)), 4_000, plainExpected.length << 1);
dumpToFile("swar-string-serialize-plain-safe-clone", "serialize");

bench("Serialize String SWAR (unsafe-clone, plain)", () => blackbox(serializeUnsafeClone(plain)), 4_000, plainExpected.length << 1);
dumpToFile("swar-string-serialize-plain-unsafe-clone", "serialize");

bench("Serialize String SWAR (current, escaped)", () => blackbox(serializeCurrent(escaped)), 4_000, escapedExpected.length << 1);
dumpToFile("swar-string-serialize-escaped-current", "serialize");

bench("Serialize String SWAR (safe-clone, escaped)", () => blackbox(serializeSafeClone(escaped)), 4_000, escapedExpected.length << 1);
dumpToFile("swar-string-serialize-escaped-safe-clone", "serialize");

bench("Serialize String SWAR (unsafe-clone, escaped)", () => blackbox(serializeUnsafeClone(escaped)), 4_000, escapedExpected.length << 1);
dumpToFile("swar-string-serialize-escaped-unsafe-clone", "serialize");
