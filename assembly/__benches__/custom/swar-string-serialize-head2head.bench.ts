import { JSON } from "../../index.ts";
import { bs } from "../../../lib/as-bs";
import { expect } from "../../__tests__/lib/index.ts";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { serializeString_SWAR, serializeString_SWAR_ExperimentalTableEscapes, detect_escapable_u64_swar_safe, detect_escapable_u64_swar_unsafe } from "../../serialize/swar/string";
import { u16_to_hex4_swar } from "../../util/swar";
import { bench, blackbox, dumpToFile } from "../lib/bench.ts";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

// @ts-expect-error: @lazy is a valid decorator
@lazy const U00_MARKER = 13511005048209500;
// @ts-expect-error: @lazy is a valid decorator
@lazy const U_MARKER = 7667804;

function makePlainPayload(targetBytes: i32): string {
  const base = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890`~!@#$%^&*()-_=+[]{}|;:,.<>/? ";
  const repeats = i32(Math.ceil(targetBytes / (base.length << 1)));
  return base.repeat(repeats).slice(0, targetBytes >> 1);
}

function makeEscapedPayload(targetBytes: i32): string {
  const base = 'ab"cd\\\\ef\\nline\\ttab\\rret\\b\\f\\u0001\\u001f';
  const repeats = i32(Math.ceil(targetBytes / (base.length << 1)));
  return base.repeat(repeats).slice(0, targetBytes >> 1);
}

const plainSample = makePlainPayload(1024 * 1024);
const escapedSample = makeEscapedPayload(1024 * 1024);

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

// @ts-expect-error: @inline is a valid decorator
@inline function shortEscapeSwitchOrZero(code: u16): u32 {
  switch (code) {
    case <u16>QUOTE: return (<u32>BACK_SLASH) | ((<u32>QUOTE) << 16);
    case <u16>BACK_SLASH: return (<u32>BACK_SLASH) | ((<u32>BACK_SLASH) << 16);
    case 8: return (<u32>BACK_SLASH) | ((<u32>98) << 16); // b
    case 9: return (<u32>BACK_SLASH) | ((<u32>116) << 16); // t
    case 10: return (<u32>BACK_SLASH) | ((<u32>110) << 16); // n
    case 12: return (<u32>BACK_SLASH) | ((<u32>102) << 16); // f
    case 13: return (<u32>BACK_SLASH) | ((<u32>114) << 16); // r
    default: return 0;
  }
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

function serializeString_SWAR_SwitchMap(src: string): void {
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
        const escaped = shortEscapeSwitchOrZero(code);
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
      const escaped = shortEscapeSwitchOrZero(code);
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

function serializeString_SWAR_AdaptiveSample(src: string): void {
  const srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const scanEnd = usize(Math.min(srcEnd, srcStart + 512)); // 256 UTF-16 code units
  const scanEnd8 = scanEnd >= srcStart + 8 ? scanEnd - 8 : srcStart;

  let hits: i32 = 0;
  let p = srcStart;
  while (p < scanEnd8) {
    if (detect_escapable_u64_swar_safe(load<u64>(p)) != 0) {
      hits++;
      if (hits >= 2) break;
    }
    p += 8;
  }

  if (hits == 0) {
    serializeString_SWAR_CopyForward(src);
  } else {
    serializeString_SWAR(src);
  }
}

// @ts-expect-error: @inline is a valid decorator
@inline function resetBenchBuffer(): usize {
  const len = bs.offset - bs.buffer;
  bs.offset = bs.buffer;
  bs.stackSize = 0;
  bs.cacheOutput = 0;
  bs.cacheOutputLen = 0;
  return len;
}

function serializeCurrentOut(src: string): string {
  serializeString_SWAR(src);
  return bs.out<string>();
}

function serializeCopyForwardOut(src: string): string {
  serializeString_SWAR_CopyForward(src);
  return bs.out<string>();
}

function serializeUnsafeDetectOut(src: string): string {
  serializeString_SWAR_UnsafeDetect(src);
  return bs.out<string>();
}

function serializeShortMapOut(src: string): string {
  serializeString_SWAR_ShortMap(src);
  return bs.out<string>();
}

function serializeRuntimeExpTableOut(src: string): string {
  serializeString_SWAR_ExperimentalTableEscapes(src);
  return bs.out<string>();
}

function serializeSwitchMapOut(src: string): string {
  serializeString_SWAR_SwitchMap(src);
  return bs.out<string>();
}

function serializeAdaptiveSampleOut(src: string): string {
  serializeString_SWAR_AdaptiveSample(src);
  return bs.out<string>();
}

// Algorithm-focused variants: avoid bs.out allocation/copy noise.
function serializeCurrentLen(src: string): usize {
  serializeString_SWAR(src);
  return resetBenchBuffer();
}

function serializeCopyForwardLen(src: string): usize {
  serializeString_SWAR_CopyForward(src);
  return resetBenchBuffer();
}

function serializeUnsafeDetectLen(src: string): usize {
  serializeString_SWAR_UnsafeDetect(src);
  return resetBenchBuffer();
}

function serializeShortMapLen(src: string): usize {
  serializeString_SWAR_ShortMap(src);
  return resetBenchBuffer();
}

function serializeRuntimeExpTableLen(src: string): usize {
  serializeString_SWAR_ExperimentalTableEscapes(src);
  return resetBenchBuffer();
}

function serializeSwitchMapLen(src: string): usize {
  serializeString_SWAR_SwitchMap(src);
  return resetBenchBuffer();
}

function serializeAdaptiveSampleLen(src: string): usize {
  serializeString_SWAR_AdaptiveSample(src);
  return resetBenchBuffer();
}

const plainExpected: string = JSON.stringify(plainSample);
const escapedExpected: string = JSON.stringify(escapedSample);

expect(serializeCurrentOut(plainSample)).toBe(plainExpected);
expect(serializeCopyForwardOut(plainSample)).toBe(plainExpected);
expect(serializeUnsafeDetectOut(plainSample)).toBe(plainExpected);
expect(serializeShortMapOut(plainSample)).toBe(plainExpected);
expect(serializeRuntimeExpTableOut(plainSample)).toBe(plainExpected);
expect(serializeSwitchMapOut(plainSample)).toBe(plainExpected);
expect(serializeAdaptiveSampleOut(plainSample)).toBe(plainExpected);

expect(serializeCurrentOut(escapedSample)).toBe(escapedExpected);
expect(serializeCopyForwardOut(escapedSample)).toBe(escapedExpected);
expect(serializeUnsafeDetectOut(escapedSample)).toBe(escapedExpected);
expect(serializeShortMapOut(escapedSample)).toBe(escapedExpected);
expect(serializeRuntimeExpTableOut(escapedSample)).toBe(escapedExpected);
expect(serializeSwitchMapOut(escapedSample)).toBe(escapedExpected);
expect(serializeAdaptiveSampleOut(escapedSample)).toBe(escapedExpected);

const plainBytes = plainExpected.length << 1;
const escapedBytes = escapedExpected.length << 1;

bench("Serialize String SWAR Current (plain)", () => blackbox(serializeCurrentLen(plainSample)), 1500, plainBytes);
dumpToFile("swar-string-serialize-current-plain", "serialize");
bench("Serialize String SWAR CopyForward (plain)", () => blackbox(serializeCopyForwardLen(plainSample)), 1500, plainBytes);
dumpToFile("swar-string-serialize-copyforward-plain", "serialize");
bench("Serialize String SWAR UnsafeDetect (plain)", () => blackbox(serializeUnsafeDetectLen(plainSample)), 1500, plainBytes);
dumpToFile("swar-string-serialize-unsafe-plain", "serialize");
bench("Serialize String SWAR ShortMap (plain)", () => blackbox(serializeShortMapLen(plainSample)), 1500, plainBytes);
dumpToFile("swar-string-serialize-shortmap-plain", "serialize");
bench("Serialize String SWAR RuntimeExpTable (plain)", () => blackbox(serializeRuntimeExpTableLen(plainSample)), 1500, plainBytes);
dumpToFile("swar-string-serialize-runtime-exptable-plain", "serialize");
bench("Serialize String SWAR SwitchMap (plain)", () => blackbox(serializeSwitchMapLen(plainSample)), 1500, plainBytes);
dumpToFile("swar-string-serialize-switchmap-plain", "serialize");
bench("Serialize String SWAR AdaptiveSample (plain)", () => blackbox(serializeAdaptiveSampleLen(plainSample)), 1500, plainBytes);
dumpToFile("swar-string-serialize-adaptive-sample-plain", "serialize");

bench("Serialize String SWAR Current (escaped)", () => blackbox(serializeCurrentLen(escapedSample)), 1500, escapedBytes);
dumpToFile("swar-string-serialize-current-escaped", "serialize");
bench("Serialize String SWAR CopyForward (escaped)", () => blackbox(serializeCopyForwardLen(escapedSample)), 1500, escapedBytes);
dumpToFile("swar-string-serialize-copyforward-escaped", "serialize");
bench("Serialize String SWAR UnsafeDetect (escaped)", () => blackbox(serializeUnsafeDetectLen(escapedSample)), 1500, escapedBytes);
dumpToFile("swar-string-serialize-unsafe-escaped", "serialize");
bench("Serialize String SWAR ShortMap (escaped)", () => blackbox(serializeShortMapLen(escapedSample)), 1500, escapedBytes);
dumpToFile("swar-string-serialize-shortmap-escaped", "serialize");
bench("Serialize String SWAR RuntimeExpTable (escaped)", () => blackbox(serializeRuntimeExpTableLen(escapedSample)), 1500, escapedBytes);
dumpToFile("swar-string-serialize-runtime-exptable-escaped", "serialize");
bench("Serialize String SWAR SwitchMap (escaped)", () => blackbox(serializeSwitchMapLen(escapedSample)), 1500, escapedBytes);
dumpToFile("swar-string-serialize-switchmap-escaped", "serialize");
bench("Serialize String SWAR AdaptiveSample (escaped)", () => blackbox(serializeAdaptiveSampleLen(escapedSample)), 1500, escapedBytes);
dumpToFile("swar-string-serialize-adaptive-sample-escaped", "serialize");
