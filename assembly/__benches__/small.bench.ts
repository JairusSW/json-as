import { JSON, JSONMode } from "..";
import { deserializeString } from "../deserialize/simple/string";
import { deserializeString_SWAR } from "../deserialize/swar/string";
import { deserializeString_SIMD } from "../deserialize/simd/string";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

const QUOTE: u16 = 0x22;
const BACK_SLASH: u16 = 0x5c;
const BRACE_LEFT: u16 = 0x7b;
const BRACE_RIGHT: u16 = 0x7d;
const BRACKET_LEFT: u16 = 0x5b;
const BRACKET_RIGHT: u16 = 0x5d;
const COMMA: u16 = 0x2c;
const COLON: u16 = 0x3a;

const TRUE_WORD_U64: u64 = 0x65007500720074;
const FALSE_WORD_U64: u64 = 0x650073006c0061;

// @ts-expect-error: decorator
@lazy const SPLAT_BACK_SLASH = i16x8.splat(BACK_SLASH);

// @ts-ignore: decorator
@inline function backslash_mask_unsafe(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  return (b - 0x0001_0001_0001_0001) & ~b & 0x0080_0080_0080_0080;
}

// @ts-ignore: decorator
@inline function copyStringToField(
  dstFieldPtr: usize,
  srcStart: usize,
  byteLength: u32,
): void {
  let current = load<usize>(dstFieldPtr);
  let outPtr: usize;
  if (
    current != 0 &&
    changetype<OBJECT>(current - TOTAL_OVERHEAD).rtSize == byteLength
  ) {
    outPtr = current;
  } else {
    outPtr = __new(byteLength, idof<string>());
    store<usize>(dstFieldPtr, outPtr);
  }
  memory.copy(outPtr, srcStart, byteLength);
}

// @ts-ignore: decorator
@inline function findStringEnd(srcStart: usize, srcEnd: usize): usize {
  if (load<u16>(srcStart) != QUOTE) return 0;
  let ptr = srcStart + 2;
  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (code == BACK_SLASH) {
      ptr += 4;
      continue;
    }
    if (code == QUOTE) return ptr;
    ptr += 2;
  }
  return 0;
}

// @ts-ignore: decorator
@inline function deserializeString_NAIVE_FAST(
  srcStart: usize,
  quoteEnd: usize,
  dstFieldPtr: usize,
): bool {
  if (load<u16>(srcStart) != QUOTE) return false;
  const payloadStart = srcStart + 2;
  let ptr = payloadStart;
  while (ptr < quoteEnd) {
    if (load<u16>(ptr) == BACK_SLASH) {
      store<string>(dstFieldPtr, deserializeString(srcStart, quoteEnd + 2));
      return true;
    }
    ptr += 2;
  }
  copyStringToField(dstFieldPtr, payloadStart, <u32>(quoteEnd - payloadStart));
  return true;
}

// @ts-ignore: decorator
@inline function deserializeString_SWAR_FAST(
  srcStart: usize,
  quoteEnd: usize,
  dstFieldPtr: usize,
): bool {
  if (load<u16>(srcStart) != QUOTE) return false;
  const payloadStart = srcStart + 2;
  let ptr = payloadStart;
  const quoteEnd8 = quoteEnd - 8;

  while (ptr <= quoteEnd8) {
    if (backslash_mask_unsafe(load<u64>(ptr)) == 0) {
      ptr += 8;
      continue;
    }
    store<string>(dstFieldPtr, deserializeString_SWAR(srcStart, quoteEnd + 2));
    return true;
  }

  while (ptr < quoteEnd) {
    if (load<u16>(ptr) == BACK_SLASH) {
      store<string>(dstFieldPtr, deserializeString_SWAR(srcStart, quoteEnd + 2));
      return true;
    }
    ptr += 2;
  }
  copyStringToField(dstFieldPtr, payloadStart, <u32>(quoteEnd - payloadStart));
  return true;
}

// @ts-ignore: decorator
@inline function deserializeString_SIMD_FAST(
  srcStart: usize,
  quoteEnd: usize,
  dstFieldPtr: usize,
): bool {
  if (load<u16>(srcStart) != QUOTE) return false;
  const payloadStart = srcStart + 2;
  let ptr = payloadStart;
  const quoteEnd16 = quoteEnd - 16;

  while (ptr <= quoteEnd16) {
    const block = load<v128>(ptr);
    const mask = i16x8.bitmask(i16x8.eq(block, SPLAT_BACK_SLASH));
    if (mask == 0) {
      ptr += 16;
      continue;
    }
    store<string>(dstFieldPtr, deserializeString_SIMD(srcStart, quoteEnd + 2));
    return true;
  }

  while (ptr < quoteEnd) {
    if (load<u16>(ptr) == BACK_SLASH) {
      store<string>(dstFieldPtr, deserializeString_SIMD(srcStart, quoteEnd + 2));
      return true;
    }
    ptr += 2;
  }
  copyStringToField(dstFieldPtr, payloadStart, <u32>(quoteEnd - payloadStart));
  return true;
}

// @ts-ignore: decorator
@inline function parseBool(ptr: usize, outPtr: usize): usize {
  const code = load<u16>(ptr);
  if (code == 116 && load<u64>(ptr) == TRUE_WORD_U64) {
    store<bool>(outPtr, true);
    return ptr + 8;
  }
  if (code == 102 && load<u64>(ptr, 2) == FALSE_WORD_U64) {
    store<bool>(outPtr, false);
    return ptr + 10;
  }
  return 0;
}

// @ts-ignore: decorator
@inline function parseU32(ptr: usize, srcEnd: usize, outPtr: usize): usize {
  let digit = <u32>load<u16>(ptr) - 48;
  if (digit > 9) return 0;

  let val: u32 = digit;
  ptr += 2;
  while (ptr < srcEnd) {
    digit = <u32>load<u16>(ptr) - 48;
    if (digit > 9) break;
    val = val * 10 + digit;
    ptr += 2;
  }

  store<u32>(outPtr, val);
  return ptr;
}

// @ts-ignore: decorator
@inline function parseString_NAIVE(
  ptr: usize,
  srcEnd: usize,
  outPtr: usize,
): usize {
  const quoteEnd = findStringEnd(ptr, srcEnd);
  if (quoteEnd == 0) return 0;
  if (!deserializeString_NAIVE_FAST(ptr, quoteEnd, outPtr)) return 0;
  return quoteEnd + 2;
}

// @ts-ignore: decorator
@inline function parseString_SWAR(ptr: usize, srcEnd: usize, outPtr: usize): usize {
  const quoteEnd = findStringEnd(ptr, srcEnd);
  if (quoteEnd == 0) return 0;
  if (!deserializeString_SWAR_FAST(ptr, quoteEnd, outPtr)) return 0;
  return quoteEnd + 2;
}

// @ts-ignore: decorator
@inline function parseString_SIMD(ptr: usize, srcEnd: usize, outPtr: usize): usize {
  const quoteEnd = findStringEnd(ptr, srcEnd);
  if (quoteEnd == 0) return 0;
  if (!deserializeString_SIMD_FAST(ptr, quoteEnd, outPtr)) return 0;
  return quoteEnd + 2;
}

// @ts-ignore: decorator
@inline function deserializeSmallFast_NAIVE(
  srcStart: usize,
  srcEnd: usize,
  authenticatedPtr: usize,
  userIdPtr: usize,
  usernamePtr: usize,
  rolePtr: usize,
  expiresAtPtr: usize,
): bool {
  do {
    if (srcEnd - srcStart < 80) break;

    let mismatch: u32 = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x007500610022007b); // {"au
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x006e006500680074); // then
    mismatch |= <u32>(load<u64>(srcStart, 16) != 0x0061006300690074); // tica
    mismatch |= <u32>(load<u64>(srcStart, 24) != 0x0022006400650074); // ted"
    mismatch |= <u32>(load<u16>(srcStart, 32) != COLON);
    if (mismatch != 0) break;
    srcStart += 34;

    const boolEnd = parseBool(srcStart, authenticatedPtr);
    if (boolEnd == 0) break;
    srcStart = boolEnd;

    mismatch = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x007300750022002c); // ,"us
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x0069005f00720065); // er_i
    mismatch |= <u32>(load<u32>(srcStart, 16) != 0x00220064); // d"
    mismatch |= <u32>(load<u16>(srcStart, 20) != COLON);
    if (mismatch != 0) break;
    srcStart += 22;

    const userEnd = parseU32(srcStart, srcEnd, userIdPtr);
    if (userEnd == 0) break;
    srcStart = userEnd;

    mismatch = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x007300750022002c); // ,"us
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x0061006e00720065); // erna
    mismatch |= <u32>(load<u64>(srcStart, 16) != 0x003a00220065006d); // me":
    if (mismatch != 0) break;
    srcStart += 24;

    const usernameEnd = parseString_NAIVE(srcStart, srcEnd, usernamePtr);
    if (usernameEnd == 0) break;
    srcStart = usernameEnd;

    mismatch = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x006f00720022002c); // ,"ro
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x003a00220065006c); // le":
    if (mismatch != 0) break;
    srcStart += 16;

    const roleEnd = parseString_NAIVE(srcStart, srcEnd, rolePtr);
    if (roleEnd == 0) break;
    srcStart = roleEnd;

    mismatch = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x007800650022002c); // ,"ex
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x0065007200690070); // pire
    mismatch |= <u32>(load<u64>(srcStart, 16) != 0x00740061005f0073); // s_at
    mismatch |= <u32>(load<u32>(srcStart, 24) != 0x003a0022); // ":
    if (mismatch != 0) break;
    srcStart += 28;

    const expiresEnd = parseString_NAIVE(srcStart, srcEnd, expiresAtPtr);
    if (expiresEnd == 0) break;
    srcStart = expiresEnd;

    if (srcStart + 2 != srcEnd) break;
    if (load<u16>(srcStart) != BRACE_RIGHT) break;
    return true;
  } while (false);

  return false;
}

// @ts-ignore: decorator
@inline function deserializeSmallFast_SWAR(
  srcStart: usize,
  srcEnd: usize,
  authenticatedPtr: usize,
  userIdPtr: usize,
  usernamePtr: usize,
  rolePtr: usize,
  expiresAtPtr: usize,
): bool {
  do {
    if (srcEnd - srcStart < 80) break;

    let mismatch: u32 = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x007500610022007b);
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x006e006500680074);
    mismatch |= <u32>(load<u64>(srcStart, 16) != 0x0061006300690074);
    mismatch |= <u32>(load<u64>(srcStart, 24) != 0x0022006400650074);
    mismatch |= <u32>(load<u16>(srcStart, 32) != COLON);
    if (mismatch != 0) break;
    srcStart += 34;

    const boolEnd = parseBool(srcStart, authenticatedPtr);
    if (boolEnd == 0) break;
    srcStart = boolEnd;

    mismatch = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x007300750022002c);
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x0069005f00720065);
    mismatch |= <u32>(load<u32>(srcStart, 16) != 0x00220064);
    mismatch |= <u32>(load<u16>(srcStart, 20) != COLON);
    if (mismatch != 0) break;
    srcStart += 22;

    const userEnd = parseU32(srcStart, srcEnd, userIdPtr);
    if (userEnd == 0) break;
    srcStart = userEnd;

    mismatch = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x007300750022002c);
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x0061006e00720065);
    mismatch |= <u32>(load<u64>(srcStart, 16) != 0x003a00220065006d);
    if (mismatch != 0) break;
    srcStart += 24;

    const usernameEnd = parseString_SWAR(srcStart, srcEnd, usernamePtr);
    if (usernameEnd == 0) break;
    srcStart = usernameEnd;

    mismatch = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x006f00720022002c);
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x003a00220065006c);
    if (mismatch != 0) break;
    srcStart += 16;

    const roleEnd = parseString_SWAR(srcStart, srcEnd, rolePtr);
    if (roleEnd == 0) break;
    srcStart = roleEnd;

    mismatch = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x007800650022002c);
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x0065007200690070);
    mismatch |= <u32>(load<u64>(srcStart, 16) != 0x00740061005f0073);
    mismatch |= <u32>(load<u32>(srcStart, 24) != 0x003a0022);
    if (mismatch != 0) break;
    srcStart += 28;

    const expiresEnd = parseString_SWAR(srcStart, srcEnd, expiresAtPtr);
    if (expiresEnd == 0) break;
    srcStart = expiresEnd;

    if (srcStart + 2 != srcEnd) break;
    if (load<u16>(srcStart) != BRACE_RIGHT) break;
    return true;
  } while (false);

  return false;
}

// @ts-ignore: decorator
@inline function deserializeSmallFast_SIMD(
  srcStart: usize,
  srcEnd: usize,
  authenticatedPtr: usize,
  userIdPtr: usize,
  usernamePtr: usize,
  rolePtr: usize,
  expiresAtPtr: usize,
): bool {
  do {
    if (srcEnd - srcStart < 80) break;

    let mismatch: u32 = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x007500610022007b);
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x006e006500680074);
    mismatch |= <u32>(load<u64>(srcStart, 16) != 0x0061006300690074);
    mismatch |= <u32>(load<u64>(srcStart, 24) != 0x0022006400650074);
    mismatch |= <u32>(load<u16>(srcStart, 32) != COLON);
    if (mismatch != 0) break;
    srcStart += 34;

    const boolEnd = parseBool(srcStart, authenticatedPtr);
    if (boolEnd == 0) break;
    srcStart = boolEnd;

    mismatch = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x007300750022002c);
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x0069005f00720065);
    mismatch |= <u32>(load<u32>(srcStart, 16) != 0x00220064);
    mismatch |= <u32>(load<u16>(srcStart, 20) != COLON);
    if (mismatch != 0) break;
    srcStart += 22;

    const userEnd = parseU32(srcStart, srcEnd, userIdPtr);
    if (userEnd == 0) break;
    srcStart = userEnd;

    mismatch = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x007300750022002c);
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x0061006e00720065);
    mismatch |= <u32>(load<u64>(srcStart, 16) != 0x003a00220065006d);
    if (mismatch != 0) break;
    srcStart += 24;

    const usernameEnd = parseString_SIMD(srcStart, srcEnd, usernamePtr);
    if (usernameEnd == 0) break;
    srcStart = usernameEnd;

    mismatch = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x006f00720022002c);
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x003a00220065006c);
    if (mismatch != 0) break;
    srcStart += 16;

    const roleEnd = parseString_SIMD(srcStart, srcEnd, rolePtr);
    if (roleEnd == 0) break;
    srcStart = roleEnd;

    mismatch = 0;
    mismatch |= <u32>(load<u64>(srcStart) != 0x007800650022002c);
    mismatch |= <u32>(load<u64>(srcStart, 8) != 0x0065007200690070);
    mismatch |= <u32>(load<u64>(srcStart, 16) != 0x00740061005f0073);
    mismatch |= <u32>(load<u32>(srcStart, 24) != 0x003a0022);
    if (mismatch != 0) break;
    srcStart += 28;

    const expiresEnd = parseString_SIMD(srcStart, srcEnd, expiresAtPtr);
    if (expiresEnd == 0) break;
    srcStart = expiresEnd;

    if (srcStart + 2 != srcEnd) break;
    if (load<u16>(srcStart) != BRACE_RIGHT) break;
    return true;
  } while (false);

  return false;
}

const KEY_AUTHENTICATED_BYTES: usize = 26;
const KEY_USER_ID_BYTES: usize = 14;
const KEY_USERNAME_BYTES: usize = 16;
const KEY_ROLE_BYTES: usize = 8;
const KEY_EXPIRES_AT_BYTES: usize = 20;

// @ts-ignore: decorator
@inline function keyEqualsAuthenticated(keyStart: usize, keyEnd: usize): bool {
  return (
    keyEnd - keyStart == KEY_AUTHENTICATED_BYTES &&
    load<u64>(keyStart) == 0x0068007400750061 &&
    load<u64>(keyStart, 8) == 0x00690074006e0065 &&
    load<u64>(keyStart, 16) == 0x0065007400610063 &&
    load<u16>(keyStart, 24) == 0x0064
  );
}

// @ts-ignore: decorator
@inline function keyEqualsUserId(keyStart: usize, keyEnd: usize): bool {
  return (
    keyEnd - keyStart == KEY_USER_ID_BYTES &&
    load<u64>(keyStart) == 0x0072006500730075 &&
    load<u32>(keyStart, 8) == 0x0069005f &&
    load<u16>(keyStart, 12) == 0x0064
  );
}

// @ts-ignore: decorator
@inline function keyEqualsUsername(keyStart: usize, keyEnd: usize): bool {
  return (
    keyEnd - keyStart == KEY_USERNAME_BYTES &&
    load<u64>(keyStart) == 0x0072006500730075 &&
    load<u64>(keyStart, 8) == 0x0065006d0061006e
  );
}

// @ts-ignore: decorator
@inline function keyEqualsRole(keyStart: usize, keyEnd: usize): bool {
  return (
    keyEnd - keyStart == KEY_ROLE_BYTES &&
    load<u64>(keyStart) == 0x0065006c006f0072
  );
}

// @ts-ignore: decorator
@inline function keyEqualsExpiresAt(keyStart: usize, keyEnd: usize): bool {
  return (
    keyEnd - keyStart == KEY_EXPIRES_AT_BYTES &&
    load<u64>(keyStart) == 0x0069007000780065 &&
    load<u64>(keyStart, 8) == 0x005f007300650072 &&
    load<u32>(keyStart, 16) == 0x00740061
  );
}

// @ts-ignore: decorator
@inline function skipJSONSpace(ptr: usize, srcEnd: usize): usize {
  while (ptr < srcEnd && JSON.Util.isSpace(load<u16>(ptr))) ptr += 2;
  return ptr;
}

// @ts-ignore: decorator
@inline function scanPrimitiveEnd(ptr: usize, srcEnd: usize): usize {
  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (
      code == COMMA ||
      code == BRACE_RIGHT ||
      code == BRACKET_RIGHT ||
      JSON.Util.isSpace(code)
    ) {
      break;
    }
    ptr += 2;
  }
  return ptr;
}

// @ts-ignore: decorator
@inline function skipJSONValue(ptr: usize, srcEnd: usize): usize {
  ptr = skipJSONSpace(ptr, srcEnd);
  if (ptr >= srcEnd) return 0;

  const first = load<u16>(ptr);
  if (first == QUOTE) {
    const quoteEnd = findStringEnd(ptr, srcEnd);
    return quoteEnd == 0 ? 0 : quoteEnd + 2;
  }

  if (first == BRACE_LEFT || first == BRACKET_LEFT) {
    const open = first;
    const close: u16 = first == BRACE_LEFT ? BRACE_RIGHT : BRACKET_RIGHT;
    let depth: i32 = 1;
    ptr += 2;

    while (ptr < srcEnd) {
      const code = load<u16>(ptr);
      if (code == QUOTE) {
        const quoteEnd = findStringEnd(ptr, srcEnd);
        if (quoteEnd == 0) return 0;
        ptr = quoteEnd + 2;
        continue;
      }
      if (code == open) {
        depth++;
      } else if (code == close) {
        if (--depth == 0) return ptr + 2;
      }
      ptr += 2;
    }
    return 0;
  }

  return scanPrimitiveEnd(ptr, srcEnd);
}

// @ts-ignore: decorator
@inline function deserializeSmallSlow_NAIVE(
  srcStart: usize,
  srcEnd: usize,
  authenticatedPtr: usize,
  userIdPtr: usize,
  usernamePtr: usize,
  rolePtr: usize,
  expiresAtPtr: usize,
): bool {
  let ptr = skipJSONSpace(srcStart, srcEnd);
  if (ptr >= srcEnd || load<u16>(ptr) != BRACE_LEFT) return false;
  ptr += 2;

  let seenMask: u32 = 0;

  while (ptr < srcEnd) {
    ptr = skipJSONSpace(ptr, srcEnd);
    if (ptr >= srcEnd) return false;

    const code = load<u16>(ptr);
    if (code == BRACE_RIGHT) {
      ptr = skipJSONSpace(ptr + 2, srcEnd);
      return ptr == srcEnd && seenMask == 31;
    }
    if (code != QUOTE) return false;

    const keyStart = ptr + 2;
    const keyEnd = findStringEnd(ptr, srcEnd);
    if (keyEnd == 0) return false;

    ptr = skipJSONSpace(keyEnd + 2, srcEnd);
    if (ptr >= srcEnd || load<u16>(ptr) != COLON) return false;
    ptr = skipJSONSpace(ptr + 2, srcEnd);
    if (ptr >= srcEnd) return false;

    if (keyEqualsAuthenticated(keyStart, keyEnd)) {
      const valueEnd = parseBool(ptr, authenticatedPtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 1;
    } else if (keyEqualsUserId(keyStart, keyEnd)) {
      const valueEnd = parseU32(ptr, srcEnd, userIdPtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 2;
    } else if (keyEqualsUsername(keyStart, keyEnd)) {
      const valueEnd = parseString_NAIVE(ptr, srcEnd, usernamePtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 4;
    } else if (keyEqualsRole(keyStart, keyEnd)) {
      const valueEnd = parseString_NAIVE(ptr, srcEnd, rolePtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 8;
    } else if (keyEqualsExpiresAt(keyStart, keyEnd)) {
      const valueEnd = parseString_NAIVE(ptr, srcEnd, expiresAtPtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 16;
    } else {
      const valueEnd = skipJSONValue(ptr, srcEnd);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
    }

    ptr = skipJSONSpace(ptr, srcEnd);
    if (ptr >= srcEnd) return false;

    const sep = load<u16>(ptr);
    if (sep == COMMA) {
      ptr += 2;
      continue;
    }
    if (sep == BRACE_RIGHT) {
      ptr = skipJSONSpace(ptr + 2, srcEnd);
      return ptr == srcEnd && seenMask == 31;
    }
    return false;
  }

  return false;
}

// @ts-ignore: decorator
@inline function deserializeSmallSlow_SWAR(
  srcStart: usize,
  srcEnd: usize,
  authenticatedPtr: usize,
  userIdPtr: usize,
  usernamePtr: usize,
  rolePtr: usize,
  expiresAtPtr: usize,
): bool {
  let ptr = skipJSONSpace(srcStart, srcEnd);
  if (ptr >= srcEnd || load<u16>(ptr) != BRACE_LEFT) return false;
  ptr += 2;

  let seenMask: u32 = 0;

  while (ptr < srcEnd) {
    ptr = skipJSONSpace(ptr, srcEnd);
    if (ptr >= srcEnd) return false;

    const code = load<u16>(ptr);
    if (code == BRACE_RIGHT) {
      ptr = skipJSONSpace(ptr + 2, srcEnd);
      return ptr == srcEnd && seenMask == 31;
    }
    if (code != QUOTE) return false;

    const keyStart = ptr + 2;
    const keyEnd = findStringEnd(ptr, srcEnd);
    if (keyEnd == 0) return false;

    ptr = skipJSONSpace(keyEnd + 2, srcEnd);
    if (ptr >= srcEnd || load<u16>(ptr) != COLON) return false;
    ptr = skipJSONSpace(ptr + 2, srcEnd);
    if (ptr >= srcEnd) return false;

    if (keyEqualsAuthenticated(keyStart, keyEnd)) {
      const valueEnd = parseBool(ptr, authenticatedPtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 1;
    } else if (keyEqualsUserId(keyStart, keyEnd)) {
      const valueEnd = parseU32(ptr, srcEnd, userIdPtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 2;
    } else if (keyEqualsUsername(keyStart, keyEnd)) {
      const valueEnd = parseString_SWAR(ptr, srcEnd, usernamePtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 4;
    } else if (keyEqualsRole(keyStart, keyEnd)) {
      const valueEnd = parseString_SWAR(ptr, srcEnd, rolePtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 8;
    } else if (keyEqualsExpiresAt(keyStart, keyEnd)) {
      const valueEnd = parseString_SWAR(ptr, srcEnd, expiresAtPtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 16;
    } else {
      const valueEnd = skipJSONValue(ptr, srcEnd);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
    }

    ptr = skipJSONSpace(ptr, srcEnd);
    if (ptr >= srcEnd) return false;

    const sep = load<u16>(ptr);
    if (sep == COMMA) {
      ptr += 2;
      continue;
    }
    if (sep == BRACE_RIGHT) {
      ptr = skipJSONSpace(ptr + 2, srcEnd);
      return ptr == srcEnd && seenMask == 31;
    }
    return false;
  }

  return false;
}

// @ts-ignore: decorator
@inline function deserializeSmallSlow_SIMD(
  srcStart: usize,
  srcEnd: usize,
  authenticatedPtr: usize,
  userIdPtr: usize,
  usernamePtr: usize,
  rolePtr: usize,
  expiresAtPtr: usize,
): bool {
  let ptr = skipJSONSpace(srcStart, srcEnd);
  if (ptr >= srcEnd || load<u16>(ptr) != BRACE_LEFT) return false;
  ptr += 2;

  let seenMask: u32 = 0;

  while (ptr < srcEnd) {
    ptr = skipJSONSpace(ptr, srcEnd);
    if (ptr >= srcEnd) return false;

    const code = load<u16>(ptr);
    if (code == BRACE_RIGHT) {
      ptr = skipJSONSpace(ptr + 2, srcEnd);
      return ptr == srcEnd && seenMask == 31;
    }
    if (code != QUOTE) return false;

    const keyStart = ptr + 2;
    const keyEnd = findStringEnd(ptr, srcEnd);
    if (keyEnd == 0) return false;

    ptr = skipJSONSpace(keyEnd + 2, srcEnd);
    if (ptr >= srcEnd || load<u16>(ptr) != COLON) return false;
    ptr = skipJSONSpace(ptr + 2, srcEnd);
    if (ptr >= srcEnd) return false;

    if (keyEqualsAuthenticated(keyStart, keyEnd)) {
      const valueEnd = parseBool(ptr, authenticatedPtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 1;
    } else if (keyEqualsUserId(keyStart, keyEnd)) {
      const valueEnd = parseU32(ptr, srcEnd, userIdPtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 2;
    } else if (keyEqualsUsername(keyStart, keyEnd)) {
      const valueEnd = parseString_SIMD(ptr, srcEnd, usernamePtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 4;
    } else if (keyEqualsRole(keyStart, keyEnd)) {
      const valueEnd = parseString_SIMD(ptr, srcEnd, rolePtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 8;
    } else if (keyEqualsExpiresAt(keyStart, keyEnd)) {
      const valueEnd = parseString_SIMD(ptr, srcEnd, expiresAtPtr);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
      seenMask |= 16;
    } else {
      const valueEnd = skipJSONValue(ptr, srcEnd);
      if (valueEnd == 0) return false;
      ptr = valueEnd;
    }

    ptr = skipJSONSpace(ptr, srcEnd);
    if (ptr >= srcEnd) return false;

    const sep = load<u16>(ptr);
    if (sep == COMMA) {
      ptr += 2;
      continue;
    }
    if (sep == BRACE_RIGHT) {
      ptr = skipJSONSpace(ptr + 2, srcEnd);
      return ptr == srcEnd && seenMask == 31;
    }
    return false;
  }

  return false;
}

@json
class SessionStatusResponse {
  authenticated!: boolean;
  user_id!: i32;
  username!: string;
  role!: string;
  expires_at!: string;


  @inline
  __DESERIALIZE<__JSON_T>(
    srcStart: usize,
    srcEnd: usize,
    out: __JSON_T,
  ): __JSON_T {
    if (JSON_MODE === JSONMode.SIMD) {
      return this.__DESERIALIZE_SIMD(srcStart, srcEnd, out);
    } else if (JSON_MODE === JSONMode.SWAR) {
      return this.__DESERIALIZE_SWAR(srcStart, srcEnd, out);
    } else {
      return this.__DESERIALIZE_NAIVE(srcStart, srcEnd, out);
    }
  }


  @inline
  __DESERIALIZE_NAIVE<__JSON_T>(
    srcStart: usize,
    srcEnd: usize,
    out: __JSON_T,
  ): __JSON_T {
    const dst = changetype<usize>(out);
    const authenticatedPtr = dst + offsetof<this>("authenticated");
    const userIdPtr = dst + offsetof<this>("user_id");
    const usernamePtr = dst + offsetof<this>("username");
    const rolePtr = dst + offsetof<this>("role");
    const expiresAtPtr = dst + offsetof<this>("expires_at");

    if (
      deserializeSmallFast_NAIVE(
        srcStart,
        srcEnd,
        authenticatedPtr,
        userIdPtr,
        usernamePtr,
        rolePtr,
        expiresAtPtr,
      ) ||
      deserializeSmallSlow_NAIVE(
        srcStart,
        srcEnd,
        authenticatedPtr,
        userIdPtr,
        usernamePtr,
        rolePtr,
        expiresAtPtr,
      )
    ) {
      return out;
    }

    throw new Error("Failed to parse JSON");
  }


  @inline
  __DESERIALIZE_SWAR<__JSON_T>(
    srcStart: usize,
    srcEnd: usize,
    out: __JSON_T,
  ): __JSON_T {
    const dst = changetype<usize>(out);
    const authenticatedPtr = dst + offsetof<this>("authenticated");
    const userIdPtr = dst + offsetof<this>("user_id");
    const usernamePtr = dst + offsetof<this>("username");
    const rolePtr = dst + offsetof<this>("role");
    const expiresAtPtr = dst + offsetof<this>("expires_at");

    if (
      deserializeSmallFast_SWAR(
        srcStart,
        srcEnd,
        authenticatedPtr,
        userIdPtr,
        usernamePtr,
        rolePtr,
        expiresAtPtr,
      ) ||
      deserializeSmallSlow_SWAR(
        srcStart,
        srcEnd,
        authenticatedPtr,
        userIdPtr,
        usernamePtr,
        rolePtr,
        expiresAtPtr,
      )
    ) {
      return out;
    }

    throw new Error("Failed to parse JSON");
  }


  @inline
  __DESERIALIZE_SIMD<__JSON_T>(
    srcStart: usize,
    srcEnd: usize,
    out: __JSON_T,
  ): __JSON_T {
    const dst = changetype<usize>(out);
    const authenticatedPtr = dst + offsetof<this>("authenticated");
    const userIdPtr = dst + offsetof<this>("user_id");
    const usernamePtr = dst + offsetof<this>("username");
    const rolePtr = dst + offsetof<this>("role");
    const expiresAtPtr = dst + offsetof<this>("expires_at");

    if (
      deserializeSmallFast_SIMD(
        srcStart,
        srcEnd,
        authenticatedPtr,
        userIdPtr,
        usernamePtr,
        rolePtr,
        expiresAtPtr,
      ) ||
      deserializeSmallSlow_SIMD(
        srcStart,
        srcEnd,
        authenticatedPtr,
        userIdPtr,
        usernamePtr,
        rolePtr,
        expiresAtPtr,
      )
    ) {
      return out;
    }

    throw new Error("Failed to parse JSON");
  }
}

const v1 = new SessionStatusResponse();

v1.authenticated = true;
v1.user_id = 8472;
v1.username = "jairus";
v1.role = "admin";
v1.expires_at = "2025-12-23T04:30:00Z";

const v2: string = JSON.stringify<SessionStatusResponse>(v1);
const byteLength: usize = v2.length << 1;

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<SessionStatusResponse>(v2))).toBe(v2);

const vSlow =
  '{ "meta": {"arr":[1,2,{"x":"y"}]}, "role":"admin", "authenticated":true, "expires_at":"2025-12-23T04:30:00Z", "username":"jairus", "user_id":8472 }';
const pSlow = JSON.parse<SessionStatusResponse>(vSlow);
expect(pSlow.authenticated).toBe(true);
expect(pSlow.user_id.toString()).toBe("8472");
expect(pSlow.username).toBe("jairus");
expect(pSlow.role).toBe("admin");
expect(pSlow.expires_at).toBe("2025-12-23T04:30:00Z");

bench(
  "Serialize Small API Response",
  () => {
    blackbox(inline.always(JSON.stringify<SessionStatusResponse>(v1)));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small", "serialize");

bench(
  "Deserialize Small API Response",
  () => {
    blackbox(inline.always(JSON.parse<SessionStatusResponse>(v2)));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small", "deserialize");
