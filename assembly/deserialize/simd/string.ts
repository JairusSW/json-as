import { bs } from "../../../lib/as-bs";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { __heap_base } from "memory";
import { QUOTE } from "../../custom/chars";
import { BACK_SLASH } from "../../custom/chars";
import { DESERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { hex4_to_u16_swar } from "../../util/swar";

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
function copyStringFromSource_SIMD(srcStart: usize, byteLength: usize): string {
  if (byteLength == 0) return changetype<string>("");
  const out = __new(byteLength, idof<string>());
  memory.copy(out, srcStart, byteLength);
  return changetype<string>(out);
}

function writeStringToField_SIMD(
  dstFieldPtr: usize,
  srcStart: usize,
  byteLength: u32,
): void {
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

// Vectorized escaped scanner for the standalone (whole-value) path. Quotes are
// already stripped, so `srcEnd` is the payload end and only `\` escapes need
// handling (no closing-quote search). Same HYBRID strategy as the field path
// (see deserializeEscapedStringField_SIMD): escape blocks use a free
// whole-block v128 store for the plain prefix; clean runs stream the first

function deserializeEscapedString_SIMD(
  payloadStart: usize,
  escapeStart: usize,
  srcEnd: usize,
): string {
  const prefixLen = <u32>(escapeStart - payloadStart);
  const outStart = bs.offset - bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart) + 16); // +16 slack for overcopy
  if (prefixLen != 0) {
    memory.copy(bs.offset, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let srcStart = escapeStart;
  const srcEnd16 = srcEnd - 16;

  while (srcStart <= srcEnd16) {
    const block = load<v128>(srcStart);
    const mask = i16x8.bitmask(i16x8.eq(block, SPLAT_5C)); // backslash only
    if (mask == 0) {
      // Stream the first clean block cheaply.
      store<v128>(bs.offset, block);
      bs.offset += 16;
      srcStart += 16;
      // If the clean run continues, bulk-copy the remainder in one shot.
      if (srcStart <= srcEnd16) {
        const b2 = load<v128>(srcStart);
        if (i16x8.bitmask(i16x8.eq(b2, SPLAT_5C)) == 0) {
          const runStart = srcStart;
          srcStart += 16;
          while (srcStart <= srcEnd16) {
            if (i16x8.bitmask(i16x8.eq(load<v128>(srcStart), SPLAT_5C)) != 0)
              break;
            srcStart += 16;
          }
          const runLen = <u32>(srcStart - runStart);
          memory.copy(bs.offset, runStart, runLen);
          bs.offset += runLen;
        }
      }
      continue;
    }

    // Escape block: one whole-block store covers the plain prefix.
    store<v128>(bs.offset, block);
    const laneIdx = usize(ctz(mask) << 1);
    bs.offset += laneIdx;
    const srcIdx = srcStart + laneIdx;
    const code = load<u16>(srcIdx, 2);
    if (code !== 0x75) {
      store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
      bs.offset += 2;
      srcStart = srcIdx + 4;
    } else {
      store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcIdx, 4)));
      bs.offset += 2;
      srcStart = srcIdx + 12;
    }
  }

  // scalar tail (< 16 bytes remaining)
  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char != BACK_SLASH) {
      store<u16>(bs.offset, char);
      bs.offset += 2;
      srcStart += 2;
      continue;
    }
    const code = load<u16>(srcStart, 2);
    if (code !== 0x75) {
      store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
      bs.offset += 2;
      srcStart += 4;
    } else {
      store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcStart, 4)));
      bs.offset += 2;
      srcStart += 12;
    }
  }

  return bs.sliceOut<string>(outStart);
}

export function deserializeString_SIMD(srcStart: usize, srcEnd: usize): string {
  // Strip quotes
  srcStart += 2;
  srcEnd -= 2;
  const payloadStart = srcStart;
  do {
    const srcEnd16Fast = srcEnd - 16;

    while (srcStart < srcEnd16Fast) {
      const block = load<v128>(srcStart);
      if (i16x8.bitmask(i16x8.eq(block, SPLAT_5C)) != 0) break;
      srcStart += 16;
    }
    if (srcStart < srcEnd16Fast) break;

    while (srcStart < srcEnd) {
      if (load<u16>(srcStart) == BACK_SLASH) break;
      srcStart += 2;
    }
    if (srcStart < srcEnd) break;

    return copyStringFromSource_SIMD(payloadStart, srcEnd - payloadStart);
  } while (false);

  srcStart = payloadStart;
  const srcEnd16 = srcEnd - 16;

  while (srcStart < srcEnd16) {
    const block = load<v128>(srcStart);
    const mask = i16x8.bitmask(i16x8.eq(block, SPLAT_5C));

    if (mask == 0) {
      srcStart += 16;
      continue;
    }

    const laneIdx = usize(ctz(mask) << 1);
    return deserializeEscapedString_SIMD(
      payloadStart,
      srcStart + laneIdx,
      srcEnd,
    );
  }

  while (srcStart < srcEnd) {
    if (load<u16>(srcStart) == BACK_SLASH) {
      return deserializeEscapedString_SIMD(payloadStart, srcStart, srcEnd);
    }
    srcStart += 2;
  }

  return copyStringFromSource_SIMD(payloadStart, srcEnd - payloadStart);
}

// Vectorized escaped scanner for the field path. `escapeStart` points at the
// first `\` located by the caller's v128 scan. Output is assembled in the
// reused `bs` scratch buffer, then written once via writeStringToField_SIMD.
//
// Strategy (validated against run-copy and pure-stream variants across escape
// densities - see __benches__/custom/simd-string-deser-variants-h2h):
//   * Escape-bearing block: a single whole-block v128 store copies the plain
//     prefix for free; then the escape is decoded scalar.
//   * Clean block: stream the first one cheaply, but if the clean run keeps
//     going, switch to one bulk memory.copy for the remainder - bandwidth-
//     optimal on long sparse runs, avoiding a per-block-store cliff on large
//     inputs. This dominates both alternatives: stream-cheap on dense escapes,

// gain. The hot no-escape scan + writeStringToField stay inline in the caller.
function deserializeEscapedStringField_SIMD(
  payloadStart: usize,
  escapeStart: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  const prefixLen = <u32>(escapeStart - payloadStart);
  bs.offset = bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart) + 16); // +16 slack for overcopy
  if (prefixLen != 0) {
    memory.copy(bs.buffer, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let srcStart = escapeStart;
  const srcEnd16 = srcEnd - 16;

  while (srcStart <= srcEnd16) {
    const block = load<v128>(srcStart);
    const mask = i16x8.bitmask(
      v128.or(i16x8.eq(block, SPLAT_5C), i16x8.eq(block, SPLAT_22)),
    );
    if (mask == 0) {
      // Stream the first clean block cheaply.
      store<v128>(bs.offset, block);
      bs.offset += 16;
      srcStart += 16;
      // If the clean run continues, bulk-copy the remainder in one shot.
      if (srcStart <= srcEnd16) {
        const b2 = load<v128>(srcStart);
        if (
          i16x8.bitmask(
            v128.or(i16x8.eq(b2, SPLAT_5C), i16x8.eq(b2, SPLAT_22)),
          ) == 0
        ) {
          const runStart = srcStart;
          srcStart += 16;
          while (srcStart <= srcEnd16) {
            const b3 = load<v128>(srcStart);
            if (
              i16x8.bitmask(
                v128.or(i16x8.eq(b3, SPLAT_5C), i16x8.eq(b3, SPLAT_22)),
              ) != 0
            )
              break;
            srcStart += 16;
          }
          const runLen = <u32>(srcStart - runStart);
          memory.copy(bs.offset, runStart, runLen);
          bs.offset += runLen;
        }
      }
      continue;
    }

    // Escape/quote block: one whole-block store covers the plain prefix.
    store<v128>(bs.offset, block);
    const laneIdx = usize(ctz(mask) << 1);
    bs.offset += laneIdx;
    const srcIdx = srcStart + laneIdx;
    const char = load<u16>(srcIdx);
    if (char == QUOTE) {
      writeStringToField_SIMD(
        dstFieldPtr,
        bs.buffer,
        <u32>(bs.offset - bs.buffer),
      );
      bs.offset = bs.buffer;
      return srcIdx + 2;
    }

    const code = load<u16>(srcIdx, 2);
    if (code !== 0x75) {
      store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
      bs.offset += 2;
      srcStart = srcIdx + 4;
    } else {
      store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcIdx, 4)));
      bs.offset += 2;
      srcStart = srcIdx + 12;
    }
  }

  // scalar tail (< 16 bytes remaining): emit chars directly.
  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      writeStringToField_SIMD(
        dstFieldPtr,
        bs.buffer,
        <u32>(bs.offset - bs.buffer),
      );
      bs.offset = bs.buffer;
      return srcStart + 2;
    }
    if (char != BACK_SLASH) {
      store<u16>(bs.offset, char);
      bs.offset += 2;
      srcStart += 2;
      continue;
    }

    const code = load<u16>(srcStart, 2);
    if (code !== 0x75) {
      store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
      bs.offset += 2;
      srcStart += 4;
    } else {
      store<u16>(bs.offset, hex4_to_u16_swar(load<u64>(srcStart, 4)));
      bs.offset += 2;
      srcStart += 12;
    }
  }

  bs.offset = bs.buffer;
  abort("Unterminated string literal");
  return srcStart;
}

export function deserializeStringField_SIMD<T extends string | null>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  const dstFieldPtr = dstObj + dstOffset;
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE)
    abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  const srcEnd16 = srcEnd - 16;
  srcStart = payloadStart;

  while (srcStart <= srcEnd16) {
    const block = load<v128>(srcStart);
    const mask = i16x8.bitmask(
      v128.or(i16x8.eq(block, SPLAT_5C), i16x8.eq(block, SPLAT_22)),
    );
    if (mask == 0) {
      srcStart += 16;
      continue;
    }

    const laneIdx = usize(ctz(mask) << 1);
    const srcIdx = srcStart + laneIdx;
    const char = load<u16>(srcIdx);
    if (char == QUOTE) {
      writeStringToField_SIMD(
        dstFieldPtr,
        payloadStart,
        <u32>(srcIdx - payloadStart),
      );
      return srcIdx + 2;
    }
    // backslash → vectorized escaped scan (no more SWAR fallback)
    return deserializeEscapedStringField_SIMD(
      payloadStart,
      srcIdx,
      srcEnd,
      dstFieldPtr,
    );
  }

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      writeStringToField_SIMD(
        dstFieldPtr,
        payloadStart,
        <u32>(srcStart - payloadStart),
      );
      return srcStart + 2;
    }
    if (char == BACK_SLASH) {
      return deserializeEscapedStringField_SIMD(
        payloadStart,
        srcStart,
        srcEnd,
        dstFieldPtr,
      );
    }
    srcStart += 2;
  }

  abort("Unterminated string literal");
  return srcStart;
}
