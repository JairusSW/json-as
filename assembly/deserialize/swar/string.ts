import { bs } from "../../../lib/as-bs";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { DESERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { hex4_to_u16_swar } from "../../util/swar";

// Overflow Pattern for Unicode Escapes (READ)
// \u0001     0 \u00|01__   + 4
// -\u0001    2 -\u0|001_   + 6
// --\u0001   4 --\u|0001   + 8
// ---\u0001  6 ---\|u0001  + 10
// Formula: overflow = lane + 4

// Overflow Pattern for Unicode Escapes (WRITE)
// * = escape, _ = empty
// \u0001     0 *___|       - 6
// -\u0001    2 -*__|       - 4
// --\u0001   4 --*_|       - 2
// ---\u0001  6 ---*|       - 0
// Formula: 6 - lane

// Overflow pattern for Short Escapes (READ)
// \n--       0 \n--|       + 0
// -\n        2 -\n-|       + 0
// --\n       4 --\n|       + 0
// ---\n      6 ---\|n      + 2
// Formula: overflow = |lane - 4|

// Overflow pattern for Short Escapes (WRITE)
// * = escape, _ = empty
// \n--       0 *--_       - 2
// -\n-       2 -*-_       - 2
// --\n       4 --*_       - 2
// ---\n      6 ---*       - 0
// Formula: overflow =

/**
 * Deserializes strings back into into their original form using SIMD operations
 * @param src string to deserialize
 * @param dst buffer to write to
 * @returns number of bytes written
 */
export function deserializeString_SWAR(srcStart: usize, srcEnd: usize): string {
  // Strip quotes
  srcStart += 2;
  srcEnd -= 2;
  const srcEnd8 = srcEnd - 8;
  bs.ensureSize(u32(srcEnd - srcStart));

  while (srcStart < srcEnd8) {
    const block = load<u64>(srcStart);
    store<u64>(bs.offset, block);

    let mask = inline.always(backslash_mask_unsafe(block));

    // Early exit
    if (mask === 0) {
      srcStart += 8;
      bs.offset += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3); // 0 2 4 6
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const dstIdx = bs.offset + laneIdx;
      const header = load<u32>(srcIdx);
      const code = <u16>(header >> 16);

      // Detect false positive (code unit where low byte is 0x5C)
      if ((header & 0xffff) !== 0x5c) continue;

      // Hot path (negative bias)
      if (code !== 0x75) {
        // Short escapes (\n \t \" \\)
        const escaped = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
        mask &= mask - usize(escaped === 0x5c);
        store<u16>(dstIdx, escaped);
        store<u32>(dstIdx, load<u32>(srcIdx, 4), 2);

        const l6 = usize(laneIdx === 6);
        bs.offset -= (1 - l6) << 1;
        srcStart += l6 << 1;
        continue;
      }

      // Unicode escape (\uXXXX)
      const block = load<u64>(srcIdx, 4); // XXXX
      const escaped = hex4_to_u16_swar(block);
      store<u16>(dstIdx, escaped);
      // store<u64>(dstIdx, load<u32>(srcIdx, 12), 2);
      srcStart += 4 + laneIdx;
      bs.offset -= 6 - laneIdx;
    } while (mask !== 0);

    bs.offset += 8;
    srcStart += 8;
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
      const block = load<u16>(srcStart);
      const escape = load<u16>(DESERIALIZE_ESCAPE_TABLE + block);
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
  return bs.out<string>();
}

// @ts-expect-error: @inline is a valid decorator
@inline function copyStringToField(dstFieldPtr: usize, srcPtr: usize, byteLength: u32): void {
  const current = load<usize>(dstFieldPtr);
  let outPtr: usize;
  if (current != 0 && changetype<OBJECT>(current - TOTAL_OVERHEAD).rtSize == byteLength) {
    outPtr = current;
  } else {
    // @ts-expect-error: __new is a runtime builtin
    outPtr = __new(byteLength, idof<string>());
    store<usize>(dstFieldPtr, outPtr);
  }
  memory.copy(outPtr, srcPtr, byteLength);
}

// @ts-expect-error: @inline is a valid decorator
@inline function quote_or_backslash_mask_unsafe(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  const q = block ^ 0x0022_0022_0022_0022;
  return ((b - 0x0001_0001_0001_0001) & ~b & 0x0080_0080_0080_0080) | ((q - 0x0001_0001_0001_0001) & ~q & 0x0080_0080_0080_0080);
}

// @ts-expect-error: @inline is a valid decorator
@inline function deserializeStringScanEscaped_SWAR(payloadStart: usize, srcStart: usize, srcEnd: usize, dstFieldPtr: usize, bsStart: usize): usize {
  const prefixLen = srcStart - payloadStart;
  bs.ensureSize(<u32>(prefixLen + 48));
  if (prefixLen > 0) {
    memory.copy(bs.offset, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let lastPtr = srcStart;
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;

  while (srcStart <= srcEnd8) {
    const block = load<u64>(srcStart);
    let mask = inline.always(quote_or_backslash_mask_unsafe(block));
    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    let handled = false;
    do {
      const laneIdx = usize(ctz(mask) >> 3); // 0 2 4 6
      mask &= mask - 1;
      const ptr = srcStart + laneIdx;
      const char = load<u16>(ptr);

      // Detect false positives where low byte match came from UTF-16 high byte
      if (char != BACK_SLASH && char != QUOTE) continue;

      const runLen = ptr - lastPtr;
      bs.ensureSize(<u32>(runLen + 12));
      if (runLen > 0) {
        memory.copy(bs.offset, lastPtr, runLen);
        bs.offset += runLen;
      }

      if (char == QUOTE) {
        copyStringToField(dstFieldPtr, bsStart, <u32>(bs.offset - bsStart));
        bs.offset = bsStart;
        return ptr + 2;
      }

      const code = load<u16>(ptr, 2);
      if (code != 0x75) {
        // Short escapes (\n \t \" \\ \/ \b \f \r)
        const escaped = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
        if (escaped == 0 && code != BACK_SLASH) abort("Invalid string escape");
        store<u16>(bs.offset, escaped);
        bs.offset += 2;
        lastPtr = ptr + 4;
      } else {
        // Unicode escape (\uXXXX)
        if (ptr + 12 > srcEnd) abort("Invalid unicode escape");
        const hex = load<u64>(ptr, 4); // XXXX
        store<u16>(bs.offset, hex4_to_u16_swar(hex));
        bs.offset += 2;
        lastPtr = ptr + 12;
      }

      srcStart = lastPtr;
      handled = true;
      break;
    } while (mask !== 0);

    if (!handled) srcStart += 8;
  }

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char != BACK_SLASH && char != QUOTE) {
      srcStart += 2;
      continue;
    }

    const runLen = srcStart - lastPtr;
    bs.ensureSize(<u32>(runLen + 12));
    if (runLen > 0) {
      memory.copy(bs.offset, lastPtr, runLen);
      bs.offset += runLen;
    }

    if (char == QUOTE) {
      copyStringToField(dstFieldPtr, bsStart, <u32>(bs.offset - bsStart));
      bs.offset = bsStart;
      return srcStart + 2;
    }

    const code = load<u16>(srcStart, 2);
    if (code != 0x75) {
      const escaped = load<u16>(DESERIALIZE_ESCAPE_TABLE + code);
      if (escaped == 0 && code != BACK_SLASH) abort("Invalid string escape");
      store<u16>(bs.offset, escaped);
      bs.offset += 2;
      srcStart += 4;
    } else {
      if (srcStart + 12 > srcEnd) abort("Invalid unicode escape");
      const hex = load<u64>(srcStart, 4); // XXXX
      store<u16>(bs.offset, hex4_to_u16_swar(hex));
      bs.offset += 2;
      srcStart += 12;
    }

    lastPtr = srcStart;
  }

  abort("Unterminated string literal");
  return srcStart;
}

// Scans a quoted string value, writes into the destination field, and returns the next unread src pointer.
export function deserializeStringScan_SWAR(srcStart: usize, srcEnd: usize, dstFieldPtr: usize): usize {
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE) abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;
  const bsStart = bs.offset;
  srcStart = payloadStart;

  while (srcStart <= srcEnd8) {
    const block = load<u64>(srcStart);
    let mask = inline.always(quote_or_backslash_mask_unsafe(block));
    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3); // 0 2 4 6
      mask &= mask - 1;
      const ptr = srcStart + laneIdx;
      const char = load<u16>(ptr);
      if (char != BACK_SLASH && char != QUOTE) continue;

      if (char == QUOTE) {
        const len = <u32>(ptr - payloadStart);
        if (len > 0) {
          bs.ensureSize(len);
          memory.copy(bs.offset, payloadStart, len);
          bs.offset += len;
        }
        copyStringToField(dstFieldPtr, bsStart, len);
        bs.offset = bsStart;
        return ptr + 2;
      }

      return deserializeStringScanEscaped_SWAR(payloadStart, ptr, srcEnd, dstFieldPtr, bsStart);
    } while (mask !== 0);

    srcStart += 8;
  }

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE) {
      const len = <u32>(srcStart - payloadStart);
      if (len > 0) {
        bs.ensureSize(len);
        memory.copy(bs.offset, payloadStart, len);
        bs.offset += len;
      }
      copyStringToField(dstFieldPtr, bsStart, len);
      bs.offset = bsStart;
      return srcStart + 2;
    }
    if (char == BACK_SLASH) {
      return deserializeStringScanEscaped_SWAR(payloadStart, srcStart, srcEnd, dstFieldPtr, bsStart);
    }
    srcStart += 2;
  }

  abort("Unterminated string literal");
  return srcStart;
}
/**
 * Computes a per-lane mask identifying UTF-16 code units whose **low byte**
 * is the ASCII backslash (`'\\'`, 0x5C).
 *
 * The mask is produced in two stages:
 * 1. Detects bytes equal to 0x5C using a SWAR equality test.
 * 2. Clears matches where 0x5C appears in the **high byte** of a UTF-16 code unit,
 *    ensuring only valid low-byte backslashes are reported.
 *
 * Each matching lane sets itself to 0x80.
 */
// @ts-expect-error: @inline is a valid decorator
@inline function backslash_mask(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  const backslash_mask = (b - 0x0001_0001_0001_0001) & ~b & 0x0080_0080_0080_0080;
  const high_byte_mask = ~(((block - 0x0100_0100_0100_0100) & ~block & 0x8000_8000_8000_8000) ^ 0x8000_8000_8000_8000) >> 8;
  return backslash_mask & high_byte_mask;
}

/**
 * Computes a per-lane mask identifying UTF-16 code units whose **low byte**
 * is the ASCII backslash (`'\\'`, 0x5C).
 *
 * Each matching lane sets itself to 0x80.
 *
 * WARNING: The low byte of a code unit *may* be a backslash, thus triggering false positives!
 * This is useful for a hot path where it is possible to detect the false positive scalarly.
 */
// @ts-expect-error: @inline is a valid decorator
@inline function backslash_mask_unsafe(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  const backslash_mask = (b - 0x0001_0001_0001_0001) & ~b & 0x0080_0080_0080_0080;
  return backslash_mask;
}
