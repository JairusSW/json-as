import { bs } from "../../../lib/as-bs";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { __heap_base } from "memory";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { DESERIALIZE_ESCAPE_TABLE } from "../../globals/tables";

function hexDigit(c: u16): u32 {
  if (c <= 0x39) return c - 0x30; // '0'-'9'
  if (c <= 0x46) return c - 0x37; // 'A'-'F'
  return c - 0x57; // 'a'-'f'
}

function hex4ToU16(srcStart: usize): u16 {
  return <u16>(
    ((hexDigit(load<u16>(srcStart)) << 12) |
      (hexDigit(load<u16>(srcStart, 2)) << 8) |
      (hexDigit(load<u16>(srcStart, 4)) << 4) |
      hexDigit(load<u16>(srcStart, 6)))
  );
}

function isHexDigit(c: u16): bool {
  return (
    (c >= 0x30 && c <= 0x39) ||
    (c >= 0x41 && c <= 0x46) ||
    (c >= 0x61 && c <= 0x66)
  );
}

// Strict RFC 8259 check for the char following a backslash, at [escPtr, srcEnd).
// Legal escapes: " \ / b f n r t and \uXXXX (4 hex digits). Throws otherwise:
// unknown escape letter, a trailing backslash, or a short / non-hex \u.
function validateEscape(escPtr: usize, srcEnd: usize): void {
  if (escPtr >= srcEnd)
    throw new Error("Invalid JSON string: incomplete escape");
  const code = load<u16>(escPtr);
  if (code == 0x75) {
    // \uXXXX
    if (escPtr + 10 > srcEnd)
      throw new Error("Invalid JSON string: incomplete \\u escape");
    if (
      !isHexDigit(load<u16>(escPtr, 2)) ||
      !isHexDigit(load<u16>(escPtr, 4)) ||
      !isHexDigit(load<u16>(escPtr, 6)) ||
      !isHexDigit(load<u16>(escPtr, 8))
    )
      throw new Error("Invalid JSON string: \\u escape needs 4 hex digits");
    return;
  }
  // short escapes: " \ / b f n r t
  if (
    code != 0x22 &&
    code != 0x5c &&
    code != 0x2f &&
    code != 0x62 &&
    code != 0x66 &&
    code != 0x6e &&
    code != 0x72 &&
    code != 0x74
  )
    throw new Error("Invalid JSON string: illegal escape");
}

export function deserializeString_NAIVE(
  srcStart: usize,
  srcEnd: usize,
): string {
  // RFC 8259: a string is quote-framed. All callers pass quote-inclusive
  // bounds, so the first and last chars must be `"` (rejects `"` alone and
  // trailing garbage like `""x`).
  if (
    srcEnd - srcStart < 4 ||
    load<u16>(srcStart) != QUOTE ||
    load<u16>(srcEnd - 2) != QUOTE
  )
    throw new Error("Invalid JSON string: missing surrounding quotes");
  // Strip quotes
  srcStart += 2;
  srcEnd -= 2;
  const outStart = bs.offset - bs.buffer;
  bs.ensureSize(u32(srcEnd - srcStart));

  while (srcStart < srcEnd) {
    const block = load<u16>(srcStart);
    store<u16>(bs.offset, block);
    srcStart += 2;

    // Early exit
    if (block !== 0x5c) {
      // RFC 8259: literal control chars (U+0000..U+001F) must be escaped.
      if (block < 0x20)
        throw new Error("Invalid JSON string: unescaped control character");
      bs.offset += 2;
      continue;
    }

    validateEscape(srcStart, srcEnd);
    const code = load<u16>(srcStart);
    if (code !== 0x75) {
      // Short escapes (\n \t \" \\)
      const block = load<u16>(srcStart);
      const escape = load<u16>(DESERIALIZE_ESCAPE_TABLE + block);
      store<u16>(bs.offset, escape);
      srcStart += 2;
    } else {
      // Unicode escape (\uXXXX)
      const escaped = hex4ToU16(srcStart + 2);
      store<u16>(bs.offset, escaped);
      srcStart += 10;
    }

    bs.offset += 2;
  }
  return bs.sliceOut<string>(outStart);
}

// Writes into the destination field, reusing or resizing the backing string.
// Mirrors `writeStringToField` in ../swar/string.ts.
function writeStringToField(
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

// Escape-bearing tail of the field parse: the clean prefix [payloadStart,
// escPos) is bulk-copied into the scratch buffer, then escapes are decoded into
// it, and the result is written to the field. Only reached when a backslash is
// actually present — the common escape-free case never touches `bs`.
function deserializeEscapedStringField_NAIVE(
  payloadStart: usize,
  escPos: usize,
  srcEnd: usize,
  dstFieldPtr: usize,
): usize {
  bs.offset = bs.buffer;
  bs.ensureSize(<u32>(srcEnd - payloadStart));

  const prefixLen = escPos - payloadStart;
  if (prefixLen) {
    memory.copy(bs.offset, payloadStart, prefixLen);
    bs.offset += prefixLen;
  }

  let srcStart = escPos;
  while (srcStart < srcEnd) {
    const block = load<u16>(srcStart);

    if (block == QUOTE) {
      writeStringToField(dstFieldPtr, bs.buffer, <u32>(bs.offset - bs.buffer));
      bs.offset = bs.buffer;
      return srcStart + 2;
    }

    if (block != BACK_SLASH) {
      store<u16>(bs.offset, block);
      bs.offset += 2;
      srcStart += 2;
      continue;
    }

    const code = load<u16>(srcStart, 2);
    if (code !== 0x75) {
      // Short escapes (\n \t \" \\)
      store<u16>(bs.offset, load<u16>(DESERIALIZE_ESCAPE_TABLE + code));
      srcStart += 4;
    } else {
      // Unicode escape (\uXXXX)
      store<u16>(bs.offset, hex4ToU16(srcStart + 4));
      srcStart += 12;
    }
    bs.offset += 2;
  }

  abort("Expected closing quote");
  return 0;
}

// NOT @inline: this is a loop-bearing scanner called per string field. As an
// always-inline entry it gets inlined into every field call site inside the
// @inline __DESERIALIZE_FAST, exploding binaryen's optimize phase on large
// schemas (~118s on the `large` bench). Kept as a single shared function — one
// call per field — matching the non-inline SWAR/SIMD field deserializers.
export function deserializeStringField_NAIVE<T extends string | null>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  const dstFieldPtr = dstObj + dstOffset;
  if (srcStart + 2 > srcEnd || load<u16>(srcStart) != QUOTE)
    abort("Expected leading quote");

  const payloadStart = srcStart + 2;
  srcStart = payloadStart;

  // Scan for the closing quote without touching the scratch buffer. For the
  // common escape-free case the bytes are a verbatim slice of the source, so we
  // copy source -> field directly (mirrors the SWAR/SIMD field paths). Only a
  // backslash diverts to the escape-decoding tail above.
  while (srcStart < srcEnd) {
    const block = load<u16>(srcStart);
    if (block == QUOTE) {
      writeStringToField(
        dstFieldPtr,
        payloadStart,
        <u32>(srcStart - payloadStart),
      );
      return srcStart + 2;
    }
    if (block == BACK_SLASH) {
      return deserializeEscapedStringField_NAIVE(
        payloadStart,
        srcStart,
        srcEnd,
        dstFieldPtr,
      );
    }
    srcStart += 2;
  }

  abort("Expected closing quote");
  return 0;
}
