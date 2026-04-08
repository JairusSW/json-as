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

function makeEscapedPayload(targetBytes: i32): string {
  const base = 'abcdefgh"ijklmnop\\\\qrstuvwx\nyz\t\b\f\r' + "\u0001" + "\u001f";
  const repeats = i32(Math.ceil(targetBytes / (base.length << 1)));
  return base.repeat(repeats).slice(0, targetBytes >> 1);
}

const sample = makeEscapedPayload(512 * 1024);

// @ts-expect-error: @inline is a valid decorator
@inline function write_u_escape_copyforward(code: u16): void {
  bs.growSize(10);
  store<u32>(bs.offset, U_MARKER); // "\u"
  store<u64>(bs.offset, u16_to_hex4_swar(code), 4);
  bs.offset += 12;
}

function serializeString_SWAR_CopyForward(src: string): void {
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
      const dstIdx = bs.offset + laneIdx;

      if ((laneIdx & 1) === 0) {
        mask &= ~(0xffff << (laneIdx << 3));
        const code = load<u16>(srcIdx);
        const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));

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
      store<u32>(dstIdx - 1, U_MARKER);
      store<u64>(dstIdx - 1, u16_to_hex4_swar(code), 4);
      store<u64>(dstIdx - 1, load<u64>(srcIdx, 1), 12);
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

// @ts-expect-error: @inline is a valid decorator
@inline function shortEscapeOrZero(code: u16): u32 {
  if (code == QUOTE) return (<u32>BACK_SLASH) | ((<u32>QUOTE) << 16);
  if (code == BACK_SLASH) return (<u32>BACK_SLASH) | ((<u32>BACK_SLASH) << 16);
  if (code == 8) return (<u32>BACK_SLASH) | ((<u32>98) << 16); // b
  if (code == 9) return (<u32>BACK_SLASH) | ((<u32>116) << 16); // t
  if (code == 10) return (<u32>BACK_SLASH) | ((<u32>110) << 16); // n
  if (code == 12) return (<u32>BACK_SLASH) | ((<u32>102) << 16); // f
  if (code == 13) return (<u32>BACK_SLASH) | ((<u32>114) << 16); // r
  return 0;
}

function serializeString_SWAR_ShortMap(src: string): void {
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
        mask &= mask - 1;
        const code = load<u16>(srcIdx);
        const escaped = shortEscapeOrZero(code);
        const dstIdx = bs.offset + laneIdx;

        if (escaped != 0) {
          bs.growSize(2);
          store<u32>(dstIdx, escaped);
          store<u64>(dstIdx, load<u64>(srcIdx, 2), 4);
          bs.offset += 2;
        } else {
          bs.growSize(10);
          store<u64>(dstIdx, U00_MARKER);
          store<u32>(dstIdx, load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2)), 8);
          store<u64>(dstIdx, load<u64>(srcIdx, 2), 12);
          bs.offset += 10;
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
      const escaped = shortEscapeOrZero(code);
      if (escaped != 0) {
        bs.growSize(2);
        store<u32>(bs.offset, escaped);
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

function serializeCurrent(src: string): string {
  serializeString_SWAR(src);
  return bs.out<string>();
}

function serializeCopyForward(src: string): string {
  serializeString_SWAR_CopyForward(src);
  return bs.out<string>();
}

function serializeUnsafeDetect(src: string): string {
  serializeString_SWAR_UnsafeDetect(src);
  return bs.out<string>();
}

function serializeShortMap(src: string): string {
  serializeString_SWAR_ShortMap(src);
  return bs.out<string>();
}

const expected: string = JSON.stringify(sample);
expect(serializeCurrent(sample)).toBe(expected);
expect(serializeCopyForward(sample)).toBe(expected);
expect(serializeUnsafeDetect(sample)).toBe(expected);
expect(serializeShortMap(sample)).toBe(expected);

bench("Serialize String SWAR (current)", () => blackbox(serializeCurrent(sample)), 4_000, expected.length << 1);
bench("Serialize String SWAR (copy-forward)", () => blackbox(serializeCopyForward(sample)), 4_000, expected.length << 1);
bench("Serialize String SWAR (unsafe-detect)", () => blackbox(serializeUnsafeDetect(sample)), 4_000, expected.length << 1);
bench("Serialize String SWAR (short-map)", () => blackbox(serializeShortMap(sample)), 4_000, expected.length << 1);
