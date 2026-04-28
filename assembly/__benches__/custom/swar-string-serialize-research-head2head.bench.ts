import { JSON } from "../../index.ts";
import { bs } from "../../../lib/as-bs";
import { expect } from "../../__tests__/lib/index.ts";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { serializeString_SWAR, detect_escapable_u64_swar_safe } from "../../serialize/swar/string";
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

const smallPlain = makePlainPayload(16 * 1024);
const mediumPlain = makePlainPayload(256 * 1024);
const largePlain = makePlainPayload(1024 * 1024);

const smallEscaped = makeEscapedPayload(16 * 1024);
const mediumEscaped = makeEscapedPayload(256 * 1024);
const largeEscaped = makeEscapedPayload(1024 * 1024);

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
@inline function isEscapableOrSurrogate(code: u16): bool {
  return code == BACK_SLASH || code == QUOTE || code < 32 || (code >= 0xd800 && code <= 0xdfff);
}

// @ts-expect-error: @inline is a valid decorator
@inline function write_u_escape_scratch(code: u16): void {
  bs.growSize(10);
  store<u32>(bs.offset, U_MARKER);
  store<u64>(bs.offset, u16_to_hex4_swar(code), 4);
  bs.offset += 12;
}

// @ts-expect-error: @inline is a valid decorator
@inline function copyRawUtf16(src: usize, bytes: usize): void {
  if (bytes == 0) return;
  bs.growSize(bytes);

  let cur = src;
  let rem = bytes;

  while (rem >= 8) {
    store<u64>(bs.offset, load<u64>(cur));
    bs.offset += 8;
    cur += 8;
    rem -= 8;
  }

  while (rem >= 2) {
    store<u16>(bs.offset, load<u16>(cur));
    bs.offset += 2;
    cur += 2;
    rem -= 2;
  }
}

function serializeString_SWAR_ScratchRunCopyShortMap(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd8 = srcEnd - 8;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd) {
    let scan = srcStart;

    while (scan < srcEnd8) {
      if (detect_escapable_u64_swar_safe(load<u64>(scan)) != 0) break;
      scan += 8;
    }

    while (scan <= srcEnd - 2) {
      const code = load<u16>(scan);
      if (isEscapableOrSurrogate(code)) break;
      scan += 2;
    }

    copyRawUtf16(srcStart, scan - srcStart);
    srcStart = scan;

    if (srcStart > srcEnd - 2) break;

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

    if (code <= 0xdbff && srcStart + 2 <= srcEnd - 2) {
      const next = load<u16>(srcStart, 2);
      if (next >= 0xdc00 && next <= 0xdfff) {
        copyRawUtf16(srcStart, 4);
        srcStart += 4;
        continue;
      }
    }

    write_u_escape_scratch(code);
    srcStart += 2;
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SWAR_ScratchRunCopyTable(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd8 = srcEnd - 8;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd) {
    let scan = srcStart;

    while (scan < srcEnd8) {
      if (detect_escapable_u64_swar_safe(load<u64>(scan)) != 0) break;
      scan += 8;
    }

    while (scan <= srcEnd - 2) {
      const code = load<u16>(scan);
      if (isEscapableOrSurrogate(code)) break;
      scan += 2;
    }

    copyRawUtf16(srcStart, scan - srcStart);
    srcStart = scan;

    if (srcStart > srcEnd - 2) break;

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

    if (code <= 0xdbff && srcStart + 2 <= srcEnd - 2) {
      const next = load<u16>(srcStart, 2);
      if (next >= 0xdc00 && next <= 0xdfff) {
        copyRawUtf16(srcStart, 4);
        srcStart += 4;
        continue;
      }
    }

    write_u_escape_scratch(code);
    srcStart += 2;
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

function serializeString_SWAR_ScratchFirstHitTable(src: string): void {
  let srcStart = changetype<usize>(src);
  const srcSize = changetype<OBJECT>(srcStart - TOTAL_OVERHEAD).rtSize;
  const srcEnd = srcStart + srcSize;
  const srcEnd8 = srcEnd - 8;

  bs.proposeSize(srcSize + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  while (srcStart < srcEnd8) {
    const block = load<u64>(srcStart);
    let mask = detect_escapable_u64_swar_safe(block);

    if (mask == 0) {
      bs.growSize(8);
      store<u64>(bs.offset, block);
      bs.offset += 8;
      srcStart += 8;
      continue;
    }

    let lane = usize(ctz(mask) >> 3);
    let prefix = lane;
    if ((lane & 1) == 1) prefix = lane - 1;

    if (prefix != 0) {
      copyRawUtf16(srcStart, prefix);
      srcStart += prefix;
    }

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
      copyRawUtf16(srcStart, 2);
      srcStart += 2;
      continue;
    }

    if (code <= 0xdbff && srcStart + 2 <= srcEnd - 2) {
      const next = load<u16>(srcStart, 2);
      if (next >= 0xdc00 && next <= 0xdfff) {
        copyRawUtf16(srcStart, 4);
        srcStart += 4;
        continue;
      }
    }

    write_u_escape_scratch(code);
    srcStart += 2;
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
      copyRawUtf16(srcStart, 2);
      srcStart += 2;
      continue;
    }

    if (code <= 0xdbff && srcStart + 2 <= srcEnd - 2) {
      const next = load<u16>(srcStart, 2);
      if (next >= 0xdc00 && next <= 0xdfff) {
        copyRawUtf16(srcStart, 4);
        srcStart += 4;
        continue;
      }
    }

    write_u_escape_scratch(code);
    srcStart += 2;
  }

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
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

function outCurrent(src: string): string {
  serializeString_SWAR(src);
  return bs.out<string>();
}

function outScratchShortMap(src: string): string {
  serializeString_SWAR_ScratchRunCopyShortMap(src);
  return bs.out<string>();
}

function outScratchTable(src: string): string {
  serializeString_SWAR_ScratchRunCopyTable(src);
  return bs.out<string>();
}

function outScratchFirstHit(src: string): string {
  serializeString_SWAR_ScratchFirstHitTable(src);
  return bs.out<string>();
}

function lenCurrent(src: string): usize {
  serializeString_SWAR(src);
  return resetBenchBuffer();
}

function lenScratchShortMap(src: string): usize {
  serializeString_SWAR_ScratchRunCopyShortMap(src);
  return resetBenchBuffer();
}

function lenScratchTable(src: string): usize {
  serializeString_SWAR_ScratchRunCopyTable(src);
  return resetBenchBuffer();
}

function lenScratchFirstHit(src: string): usize {
  serializeString_SWAR_ScratchFirstHitTable(src);
  return resetBenchBuffer();
}

function verify(sample: string): void {
  const expected = JSON.stringify(sample);
  expect(outCurrent(sample)).toBe(expected);
  expect(outScratchShortMap(sample)).toBe(expected);
  expect(outScratchTable(sample)).toBe(expected);
  expect(outScratchFirstHit(sample)).toBe(expected);
}

verify(smallPlain);
verify(mediumPlain);
verify(largePlain);
verify(smallEscaped);
verify(mediumEscaped);
verify(largeEscaped);

const bytesSmallPlain = JSON.stringify(smallPlain).length << 1;
const bytesMediumPlain = JSON.stringify(mediumPlain).length << 1;
const bytesLargePlain = JSON.stringify(largePlain).length << 1;
const bytesSmallEscaped = JSON.stringify(smallEscaped).length << 1;
const bytesMediumEscaped = JSON.stringify(mediumEscaped).length << 1;
const bytesLargeEscaped = JSON.stringify(largeEscaped).length << 1;

bench("Research SWAR Current (small plain)", () => blackbox(lenCurrent(smallPlain)), 30000, bytesSmallPlain);
dumpToFile("swar-string-serialize-research-current-small-plain", "serialize");
bench("Research SWAR Scratch RunCopy ShortMap (small plain)", () => blackbox(lenScratchShortMap(smallPlain)), 30000, bytesSmallPlain);
dumpToFile("swar-string-serialize-research-scratch-shortmap-small-plain", "serialize");
bench("Research SWAR Scratch RunCopy Table (small plain)", () => blackbox(lenScratchTable(smallPlain)), 30000, bytesSmallPlain);
dumpToFile("swar-string-serialize-research-scratch-table-small-plain", "serialize");
bench("Research SWAR Scratch FirstHit Table (small plain)", () => blackbox(lenScratchFirstHit(smallPlain)), 30000, bytesSmallPlain);
dumpToFile("swar-string-serialize-research-scratch-firsthit-small-plain", "serialize");

bench("Research SWAR Current (medium plain)", () => blackbox(lenCurrent(mediumPlain)), 4000, bytesMediumPlain);
dumpToFile("swar-string-serialize-research-current-medium-plain", "serialize");
bench("Research SWAR Scratch RunCopy ShortMap (medium plain)", () => blackbox(lenScratchShortMap(mediumPlain)), 4000, bytesMediumPlain);
dumpToFile("swar-string-serialize-research-scratch-shortmap-medium-plain", "serialize");
bench("Research SWAR Scratch RunCopy Table (medium plain)", () => blackbox(lenScratchTable(mediumPlain)), 4000, bytesMediumPlain);
dumpToFile("swar-string-serialize-research-scratch-table-medium-plain", "serialize");
bench("Research SWAR Scratch FirstHit Table (medium plain)", () => blackbox(lenScratchFirstHit(mediumPlain)), 4000, bytesMediumPlain);
dumpToFile("swar-string-serialize-research-scratch-firsthit-medium-plain", "serialize");

bench("Research SWAR Current (large plain)", () => blackbox(lenCurrent(largePlain)), 1200, bytesLargePlain);
dumpToFile("swar-string-serialize-research-current-large-plain", "serialize");
bench("Research SWAR Scratch RunCopy ShortMap (large plain)", () => blackbox(lenScratchShortMap(largePlain)), 1200, bytesLargePlain);
dumpToFile("swar-string-serialize-research-scratch-shortmap-large-plain", "serialize");
bench("Research SWAR Scratch RunCopy Table (large plain)", () => blackbox(lenScratchTable(largePlain)), 1200, bytesLargePlain);
dumpToFile("swar-string-serialize-research-scratch-table-large-plain", "serialize");
bench("Research SWAR Scratch FirstHit Table (large plain)", () => blackbox(lenScratchFirstHit(largePlain)), 1200, bytesLargePlain);
dumpToFile("swar-string-serialize-research-scratch-firsthit-large-plain", "serialize");

bench("Research SWAR Current (small escaped)", () => blackbox(lenCurrent(smallEscaped)), 30000, bytesSmallEscaped);
dumpToFile("swar-string-serialize-research-current-small-escaped", "serialize");
bench("Research SWAR Scratch RunCopy ShortMap (small escaped)", () => blackbox(lenScratchShortMap(smallEscaped)), 30000, bytesSmallEscaped);
dumpToFile("swar-string-serialize-research-scratch-shortmap-small-escaped", "serialize");
bench("Research SWAR Scratch RunCopy Table (small escaped)", () => blackbox(lenScratchTable(smallEscaped)), 30000, bytesSmallEscaped);
dumpToFile("swar-string-serialize-research-scratch-table-small-escaped", "serialize");
bench("Research SWAR Scratch FirstHit Table (small escaped)", () => blackbox(lenScratchFirstHit(smallEscaped)), 30000, bytesSmallEscaped);
dumpToFile("swar-string-serialize-research-scratch-firsthit-small-escaped", "serialize");

bench("Research SWAR Current (medium escaped)", () => blackbox(lenCurrent(mediumEscaped)), 4000, bytesMediumEscaped);
dumpToFile("swar-string-serialize-research-current-medium-escaped", "serialize");
bench("Research SWAR Scratch RunCopy ShortMap (medium escaped)", () => blackbox(lenScratchShortMap(mediumEscaped)), 4000, bytesMediumEscaped);
dumpToFile("swar-string-serialize-research-scratch-shortmap-medium-escaped", "serialize");
bench("Research SWAR Scratch RunCopy Table (medium escaped)", () => blackbox(lenScratchTable(mediumEscaped)), 4000, bytesMediumEscaped);
dumpToFile("swar-string-serialize-research-scratch-table-medium-escaped", "serialize");
bench("Research SWAR Scratch FirstHit Table (medium escaped)", () => blackbox(lenScratchFirstHit(mediumEscaped)), 4000, bytesMediumEscaped);
dumpToFile("swar-string-serialize-research-scratch-firsthit-medium-escaped", "serialize");

bench("Research SWAR Current (large escaped)", () => blackbox(lenCurrent(largeEscaped)), 1200, bytesLargeEscaped);
dumpToFile("swar-string-serialize-research-current-large-escaped", "serialize");
bench("Research SWAR Scratch RunCopy ShortMap (large escaped)", () => blackbox(lenScratchShortMap(largeEscaped)), 1200, bytesLargeEscaped);
dumpToFile("swar-string-serialize-research-scratch-shortmap-large-escaped", "serialize");
bench("Research SWAR Scratch RunCopy Table (large escaped)", () => blackbox(lenScratchTable(largeEscaped)), 1200, bytesLargeEscaped);
dumpToFile("swar-string-serialize-research-scratch-table-large-escaped", "serialize");
bench("Research SWAR Scratch FirstHit Table (large escaped)", () => blackbox(lenScratchFirstHit(largeEscaped)), 1200, bytesLargeEscaped);
dumpToFile("swar-string-serialize-research-scratch-firsthit-large-escaped", "serialize");
