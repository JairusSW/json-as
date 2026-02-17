import { JSON, JSONMode } from "../";
import { deserializeString } from "../deserialize/simple/string";
import { deserializeString_SWAR } from "../deserialize/swar/string";
import { deserializeString_SIMD } from "../deserialize/simd/string";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { bench, blackbox, dumpToFile } from "./lib/bench";
import { expect } from "../__tests__/lib";

const QUOTE: u16 = 0x22;
const BACK_SLASH: u16 = 0x5c;
const BRACE_RIGHT: u16 = 0x7d;

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
    let mask = backslash_mask_unsafe(load<u64>(ptr));
    if (mask == 0) {
      ptr += 8;
      continue;
    }

    do {
      const lane = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const at = ptr + lane;
      // Detect false positive where high byte equals 0x5c.
      if ((load<u32>(at) & 0xffff) == BACK_SLASH) {
        store<string>(
          dstFieldPtr,
          deserializeString_SWAR(srcStart, quoteEnd + 2),
        );
        return true;
      }
    } while (mask != 0);
    ptr += 8;
  }

  while (ptr < quoteEnd) {
    if (load<u16>(ptr) == BACK_SLASH) {
      store<string>(
        dstFieldPtr,
        deserializeString_SWAR(srcStart, quoteEnd + 2),
      );
      return true;
    }
    ptr += 2;
  }
  copyStringToField(dstFieldPtr, payloadStart, <u32>(quoteEnd - payloadStart));
  return true;
}

// @ts-expect-error: decorator
@lazy const SPLAT_BACK_SLASH = i16x8.splat(BACK_SLASH);

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
    let mask = i16x8.bitmask(i16x8.eq(block, SPLAT_BACK_SLASH));
    if (mask == 0) {
      ptr += 16;
      continue;
    }

    do {
      mask &= mask - 1;
      store<string>(
        dstFieldPtr,
        deserializeString_SIMD(srcStart, quoteEnd + 2),
      );
      return true;
    } while (mask != 0);
  }

  while (ptr < quoteEnd) {
    if (load<u16>(ptr) == BACK_SLASH) {
      store<string>(
        dstFieldPtr,
        deserializeString_SIMD(srcStart, quoteEnd + 2),
      );
      return true;
    }
    ptr += 2;
  }
  copyStringToField(dstFieldPtr, payloadStart, <u32>(quoteEnd - payloadStart));
  return true;
}


@json
class Token {
  uid: u32 = 256;
  token: string = "dewf32df@#G43g3Gs!@3sdfDS#2";


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
    const uidPtr = dst + offsetof<this>("uid");
    const tokenPtr = dst + offsetof<this>("token");

    do {
      if (srcEnd - srcStart < 40) break;

      let mismatch: u32 = 0;
      mismatch |= <u32>(load<u64>(srcStart) != 0x6900750022007b); // {"ui
      mismatch |= <u32>(load<u32>(srcStart, 8) != 0x220064); // d"
      mismatch |= <u32>(load<u16>(srcStart, 12) != 58); // :
      if (mismatch != 0) break;
      srcStart += 14;

      let digit = <u32>load<u16>(srcStart) - 48;
      if (digit > 9) break;
      let val = digit;
      srcStart += 2;
      while ((digit = <u32>load<u16>(srcStart) - 48) < 10) {
        val = val * 10 + digit;
        srcStart += 2;
      }
      store<u32>(uidPtr, val);

      mismatch = 0;
      mismatch |= <u32>(load<u64>(srcStart) != 0x6f00740022002c); // ,"to
      mismatch |= <u32>(load<u64>(srcStart, 8) != 0x22006e0065006b); // ken"
      mismatch |= <u32>(load<u16>(srcStart, 16) != 58); // :
      if (mismatch != 0) break;
      srcStart += 18;

      const quoteEnd = srcEnd - 4;
      if (quoteEnd <= srcStart) break;
      mismatch = 0;
      mismatch |= <u32>(load<u16>(quoteEnd) != QUOTE);
      mismatch |= <u32>(load<u16>(srcEnd - 2) != BRACE_RIGHT);
      if (mismatch != 0) break;
      if (!deserializeString_NAIVE_FAST(srcStart, quoteEnd, tokenPtr)) break;
      return out;
    } while (false);

    throw new Error("Failed to parse JSON");
  }


  @inline
  __DESERIALIZE_SWAR<__JSON_T>(
    srcStart: usize,
    srcEnd: usize,
    out: __JSON_T,
  ): __JSON_T {
    const dst = changetype<usize>(out);
    const uidPtr = dst + offsetof<this>("uid");
    const tokenPtr = dst + offsetof<this>("token");

    do {
      if (srcEnd - srcStart < 40) break;

      let mismatch: u32 = 0;
      mismatch |= <u32>(load<u64>(srcStart) != 0x6900750022007b); // {"ui
      mismatch |= <u32>(load<u32>(srcStart, 8) != 0x220064); // d"
      mismatch |= <u32>(load<u16>(srcStart, 12) != 58); // :
      if (mismatch != 0) break;
      srcStart += 14;

      let digit = <u32>load<u16>(srcStart) - 48;
      if (digit > 9) break;
      let val = digit;
      srcStart += 2;
      while ((digit = <u32>load<u16>(srcStart) - 48) < 10) {
        val = val * 10 + digit;
        srcStart += 2;
      }
      store<u32>(uidPtr, val);

      mismatch = 0;
      mismatch |= <u32>(load<u64>(srcStart) != 0x6f00740022002c); // ,"to
      mismatch |= <u32>(load<u64>(srcStart, 8) != 0x22006e0065006b); // ken"
      mismatch |= <u32>(load<u16>(srcStart, 16) != 58); // :
      if (mismatch != 0) break;
      srcStart += 18;

      const quoteEnd = srcEnd - 4;
      if (quoteEnd <= srcStart) break;
      mismatch = 0;
      mismatch |= <u32>(load<u16>(quoteEnd) != QUOTE);
      mismatch |= <u32>(load<u16>(srcEnd - 2) != BRACE_RIGHT);
      if (mismatch != 0) break;
      if (!deserializeString_SWAR_FAST(srcStart, quoteEnd, tokenPtr)) break;
      return out;
    } while (false);

    throw new Error("Failed to parse JSON");
  }


  @inline
  __DESERIALIZE_SIMD<__JSON_T>(
    srcStart: usize,
    srcEnd: usize,
    out: __JSON_T,
  ): __JSON_T {
    const dst = changetype<usize>(out);
    const uidPtr = dst + offsetof<this>("uid");
    const tokenPtr = dst + offsetof<this>("token");

    do {
      if (srcEnd - srcStart < 40) break;

      let mismatch: u32 = 0;
      mismatch |= <u32>(load<u64>(srcStart) != 0x6900750022007b); // {"ui
      mismatch |= <u32>(load<u32>(srcStart, 8) != 0x220064); // d"
      mismatch |= <u32>(load<u16>(srcStart, 12) != 58); // :
      if (mismatch != 0) break;
      srcStart += 14;

      let digit = <u32>load<u16>(srcStart) - 48;
      if (digit > 9) break;
      let val = digit;
      srcStart += 2;
      while ((digit = <u32>load<u16>(srcStart) - 48) < 10) {
        val = val * 10 + digit;
        srcStart += 2;
      }
      store<u32>(uidPtr, val);

      mismatch = 0;
      mismatch |= <u32>(load<u64>(srcStart) != 0x6f00740022002c); // ,"to
      mismatch |= <u32>(load<u64>(srcStart, 8) != 0x22006e0065006b); // ken"
      mismatch |= <u32>(load<u16>(srcStart, 16) != 58); // :
      if (mismatch != 0) break;
      srcStart += 18;

      const quoteEnd = srcEnd - 4;
      if (quoteEnd <= srcStart) break;
      mismatch = 0;
      mismatch |= <u32>(load<u16>(quoteEnd) != QUOTE);
      mismatch |= <u32>(load<u16>(srcEnd - 2) != BRACE_RIGHT);
      if (mismatch != 0) break;
      if (!deserializeString_SIMD_FAST(srcStart, quoteEnd, tokenPtr)) break;
      return out;
    } while (false);

    throw new Error("Failed to parse JSON");
  }
}

const tok = new Token();

const objStr = '{"uid":256,"token":"dewf32df@#G43g3Gs!@3sdfDS#2"}';
expect(JSON.stringify(tok)).toBe(objStr);
expect(JSON.stringify(JSON.parse<Token>(objStr))).toBe(objStr);

const objStrEnd = changetype<usize>(objStr) + (objStr.length << 1);

bench(
  "Serialize Token Object",
  () => {
    blackbox<string>(JSON.stringify(tok));
  },
  10_000_000,
  objStr.length << 1,
);
dumpToFile("token", "serialize");

bench(
  "Deserialize Token Object",
  () => {
    blackbox<Token>(JSON.parse<Token>(objStr));
    // @ts-ignore
    // tok.__DESERIALIZE<Token>(changetype<usize>(objStr), objStrEnd, tok);
  },
  10_000_000,
  objStr.length << 1,
);
dumpToFile("token", "deserialize");
