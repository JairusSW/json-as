import { bs } from "../../../lib/as-bs";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { __heap_base } from "memory";
import { QUOTE } from "../../custom/chars";
import { BACK_SLASH } from "../../custom/chars";
import { DESERIALIZE_ESCAPE_TABLE, ESCAPE_HEX_TABLE } from "../../globals/tables";
import { hex4_to_u16_swar } from "../../util/swar";
import { deserializeStringField_SWAR } from "../swar/string";

// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_5C = i16x8.splat(0x5c); // \
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_22 = i16x8.splat(0x22); // "

// Overflow Pattern for Unicode Escapes (READ)
// \u0001        0  \u0001__|      + 0
// -\u0001       2  -\u0001_|      + 0
// --\u0001      4  --\u0001|      + 0
// ---\u0001     6  ---\u000|1     + 2
// ----\u0001    8  ----\u00|01    + 4
// -----\u0001   10 -----\u0|001   + 6
// ------\u0001  12 ------\u|0001  + 8
// -------\u0001 14 -------\|u0001 + 10
// Formula: overflow = max(0, lane - 4)

// Overflow Pattern for Unicode Escapes (WRITE)
// * = escape, _ = empty
// \u0001        0  *_______|      - 14
// -\u0001       2  -*______|      - 12
// --\u0001      4  --*_____|      - 10
// ---\u0001     6  ---*____|      - 8
// ----\u0001    8  ----*___|      - 6
// -----\u0001   10 -----*__|      - 4
// ------\u0001  12 ------*_|      - 2
// -------\u0001 14 -------*|      + 0
// Formula: overflow = lane - 14

// Overflow pattern for Short Escapes (READ)
// \n------       0  \n------|     - 12
// -\n-----       2  -\n-----|     - 10
// --\n----       4  --\n----|     - 8
// ---\n---       6  ---\n---|     - 6
// ----\n--       8  ----\n--|     - 4
// -----\n-       10 -----\n-|     - 2
// ------\n       12 ------\n|     + 0
// -------\n      14 -------\|n    + 2
// Formula: overflow = lane - 12

// Overflow pattern for Short Escapes (WRITE)
// * = escape, _ = empty
// \n------       0  *_______|     - 14
// -\n-----       2  -*______|     - 12
// --\n----       4  --*_____|     - 10
// ---\n---       6  ---*____|     - 8
// ----\n--       8  ----*___|     - 6
// -----\n-       10 -----*__|     - 4
// ------\n       12 ------*_|     - 2
// -------\n      14 -------*|     + 0
// Formula: overflow = lane - 14

/**
 * Deserializes strings back into into their original form using SIMD operations
 * @param src string to deserialize
 * @param dst buffer to write to
 * @returns number of bytes written
 */
// @ts-expect-error: @inline is a valid decorator
@inline function copyStringFromSource_SIMD(srcStart: usize, byteLength: usize): string {
  if (byteLength == 0) return changetype<string>("");
  // @ts-expect-error: __new is a runtime builtin
  const out = __new(byteLength, idof<string>());
  memory.copy(out, srcStart, byteLength);
  return changetype<string>(out);
}

// @ts-expect-error: @inline is a valid decorator
@inline function writeStringToField_SIMD(dstFieldPtr: usize, srcStart: usize, byteLength: u32): void {
  if (byteLength == 0) {
    store<usize>(dstFieldPtr, changetype<usize>(""));
    return;
  }

  const current = load<usize>(dstFieldPtr);
  let stringPtr: usize;
  if (current >= __heap_base) {
    if (changetype<OBJECT>(current - TOTAL_OVERHEAD).rtSize == byteLength) {
      stringPtr = current;
    } else {
      stringPtr = __renew(current, byteLength);
      store<usize>(dstFieldPtr, stringPtr);
    }
  } else {
    stringPtr = __new(byteLength, idof<string>());
    store<usize>(dstFieldPtr, stringPtr);
  }
  memory.copy(stringPtr, srcStart, byteLength);
}

// @ts-expect-error: @inline is a valid decorator

// todo: optimize and stuff. it works, its not pretty. ideally, i'd like this to be (nearly) branchless
// @ts-expect-error: @inline is a valid decorator
@inline function deserializeEscapedString_SIMD(payloadStart: usize, escapeStart: usize, srcEnd: usize): string {
  const prefixLen = <u32>(escapeStart - payloadStart);
  let srcStart = escapeStart;
  const srcEnd16 = srcEnd - 16;
  const outStart = bs.offset - bs.buffer;
  bs.ensureSize(u32(srcEnd - srcStart));
  if (prefixLen != 0) {
    memory.copy(bs.offset, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    store<v128>(bs.offset, block);

    const eq5C = i16x8.eq(block, SPLAT_5C);
    let mask = i16x8.bitmask(eq5C);

    if (mask == 0) {
      srcStart += 16;
      bs.offset += 16;
      continue;
    }

    let srcChg: usize = 0;
    let lastLane: usize = 0;
    do {
      const laneIdx = usize(ctz(mask) << 1); // 0 2 4 6 8 10 12 14
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const code = load<u16>(srcIdx, 2);

      bs.offset += laneIdx - lastLane;

      // Hot path (negative bias)
      if (code !== 0x75) {
        // Short escapes (\n \t \" \\)
        const escaped = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
        mask &= mask - i32(escaped === 0x5c);
        store<u16>(bs.offset, escaped);
        store<v128>(bs.offset, load<v128>(srcIdx, 4), 2);

        const l6 = usize(laneIdx === 14);
        // bs.offset -= (1 - l6) << 1;
        bs.offset += 2;
        srcStart += l6 << 1;
        lastLane = laneIdx + 4;
        continue;
      }

      // Unicode escape (\uXXXX)
      const block = load<u64>(srcIdx, 4); // XXXX
      const escaped = hex4_to_u16_swar(block);

      store<u16>(bs.offset, escaped);
      store<u64>(bs.offset, load<u64>(srcIdx, 12), 2);

      bs.offset += 2;
      if (laneIdx >= 6) {
        srcStart += laneIdx - 4;
      }
      lastLane = laneIdx + 12;
    } while (mask !== 0);

    if (lastLane < 16) {
      bs.offset += 16 - lastLane;
    }

    srcStart += 16 + srcChg;
  }

  while (srcStart < srcEnd) {
    const block = load<u16>(srcStart);
    store<u16>(bs.offset, block);
    srcStart += 2;

    // Early exit
    if (block !== 0x5c) {
      bs.offset += 2;
      continue;
    }

    const code = load<u16>(srcStart);
    if (code !== 0x75) {
      // Short escapes (\n \t \" \\)
      const escape = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
      store<u16>(bs.offset, escape);
      srcStart += 2;
    } else {
      // Unicode escape (\uXXXX)
      const block = load<u64>(srcStart, 2); // XXXX
      const escaped = hex4_to_u16_swar(block);
      store<u16>(bs.offset, escaped);
      srcStart += 10;
    }
    bs.offset += 2;
  }

  return bs.sliceOut<string>(outStart);
}

export function deserializeString_SIMD(srcStart: usize, srcEnd: usize): string {
  // Strip quotes
  srcStart += 2;
  srcEnd -= 2;
  const payloadStart = srcStart;
  const srcEnd16 = srcEnd - 16;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    const mask = i16x8.bitmask(i16x8.eq(block, SPLAT_5C));

    if (mask == 0) {
      srcStart += 16;
      continue;
    }

    const laneIdx = usize(ctz(mask) << 1);
    return inline.always(deserializeEscapedString_SIMD(payloadStart, srcStart + laneIdx, srcEnd));
  }

  while (srcStart < srcEnd) {
    if (load<u16>(srcStart) == BACK_SLASH) {
      return inline.always(deserializeEscapedString_SIMD(payloadStart, srcStart, srcEnd));
    }
    srcStart += 2;
  }

  return copyStringFromSource_SIMD(payloadStart, srcEnd - payloadStart);
}

// @ts-expect-error: @inline is a valid decorator
@inline export function deserializeStringField_SIMD<T extends string | null>(srcStart: usize, srcEnd: usize, dstObj: usize, dstOffset: usize = 0): usize {
  const dstFieldPtr = dstObj + dstOffset;
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE) abort("Expected leading quote");

  const quotedStart = srcStart;
  const payloadStart = srcStart + 2;
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;
  srcStart = payloadStart;

  while (srcStart <= srcEnd16) {
    const block = load<v128>(srcStart);
    let mask = i16x8.bitmask(v128.or(i16x8.eq(block, SPLAT_5C), i16x8.eq(block, SPLAT_22)));

    if (mask == 0) {
      srcStart += 16;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) << 1);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const char = load<u16>(srcIdx);

      if (char == QUOTE) {
        writeStringToField_SIMD(dstFieldPtr, payloadStart, <u32>(srcIdx - payloadStart));
        return srcIdx + 2;
      }

      if (char == BACK_SLASH) {
        return deserializeStringField_SWAR<T>(quotedStart, srcEnd, dstFieldPtr);
      }
    } while (mask != 0);

    srcStart += 16;
  }

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      writeStringToField_SIMD(dstFieldPtr, payloadStart, <u32>(srcStart - payloadStart));
      return srcStart + 2;
    }
    if (char == BACK_SLASH) {
      return deserializeStringField_SWAR<T>(quotedStart, srcEnd, dstFieldPtr);
    }
    srcStart += 2;
  }

  abort("Unterminated string literal");
  return srcStart;
}
