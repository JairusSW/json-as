import { newNativeArray } from "../../../util/nativeArray";
import { reuseComposite } from "../../parseMode";
import {
  BACK_SLASH,
  BRACE_LEFT,
  BRACE_RIGHT,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  COMMA,
  QUOTE,
} from "../../../custom/chars";
import { isSpace } from "../../../util";

/** Advance past JSON whitespace (space, tab, LF, CR). */
export function skipWhitespace(srcStart: usize, srcEnd: usize): usize {
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  return srcStart;
}

export function ensureArrayField<T extends Array<any>>(fieldPtr: usize): T {
  let out = changetype<T>(reuseComposite(load<usize>(fieldPtr), fieldPtr));
  if (!changetype<usize>(out)) {
    out = changetype<T>(newNativeArray<T>());
    store<T>(fieldPtr, out);
  }
  return out;
}

export function ensureArrayFieldAt<T extends Array<any>>(
  dstObj: usize,
  dstOffset: usize,
): T {
  let out = changetype<T>(
    reuseComposite(load<usize>(dstObj, dstOffset), dstObj + dstOffset),
  );
  if (!changetype<usize>(out)) {
    out = changetype<T>(newNativeArray<T>());
    store<T>(dstObj, out, dstOffset);
  }
  return out;
}

function backslashOrQuoteMask(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  const q = block ^ 0x0022_0022_0022_0022;
  return (
    (((q - 0x0001_0001_0001_0001) & ~q) | ((b - 0x0001_0001_0001_0001) & ~b)) &
    0x0080_0080_0080_0080
  );
}

export function ensureArrayElementSlot<T extends Array<any>>(
  out: T,
  index: i32,
): usize {
  const nextLength = index + 1;
  if (out.length < nextLength) {
    // The base Array index setter grows geometrically and links references.
    // It cannot invoke an overridden push method or alter the decoded value.
    const storage = changetype<Array<valueof<T>>>(out);
    if (isManaged<valueof<T>>() || isReference<valueof<T>>()) {
      storage[index] = changetype<valueof<T>>(0);
    } else {
      storage[index] = <valueof<T>>0;
    }
  }
  return out.dataStart + <usize>index * sizeof<valueof<T>>();
}

export function scanQuotedValueEnd_SWAR(srcStart: usize, srcEnd: usize): usize {
  srcStart += 2;
  const srcEnd8 = srcEnd - 8;

  while (srcStart <= srcEnd8) {
    let mask = backslashOrQuoteMask(load<u64>(srcStart));
    if (mask === 0) {
      srcStart += 8;
      continue;
    }

    do {
      const laneIdx = usize(ctz(mask) >> 3);
      mask &= mask - 1;
      const srcIdx = srcStart + laneIdx;
      const char = load<u16>(srcIdx);
      if (char == QUOTE) return srcIdx + 2;
      if (char == BACK_SLASH) break;
    } while (mask !== 0);

    break;
  }

  // Every preceding SWAR chunk was free of backslashes. Scan the entire
  // current chunk/tail so escape parity is retained across chunk boundaries.
  let escaped = false;
  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE && !escaped) return srcStart + 2;
    escaped = char == BACK_SLASH ? !escaped : false;
    srcStart += 2;
  }

  return 0;
}

export function scanValueEnd<T = usize>(srcStart: usize, srcEnd: usize): usize {
  if (srcStart >= srcEnd) return 0;
  const first = load<u16>(srcStart);

  if (first == QUOTE) return scanQuotedValueEnd_SWAR(srcStart, srcEnd);

  if (first == BRACE_LEFT || first == BRACKET_LEFT) {
    let depth: i32 = 1;
    let ptr = srcStart + 2;
    while (ptr < srcEnd) {
      const code = load<u16>(ptr);
      if (code == QUOTE) {
        ptr = scanQuotedValueEnd_SWAR(ptr, srcEnd);
        if (!ptr) return 0;
        continue;
      }
      if (code == BRACE_LEFT || code == BRACKET_LEFT) {
        depth++;
      } else if (code == BRACE_RIGHT || code == BRACKET_RIGHT) {
        if (--depth == 0) return ptr + 2;
      }
      ptr += 2;
    }
    return 0;
  }

  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    // Stop at the structural terminator OR trailing whitespace, so the returned
    // range is the exact value (scalar parsers assume no trailing whitespace).
    // Callers skip whitespace to reach the following `,`/`]`/`}`.
    if (
      code == COMMA ||
      code == BRACKET_RIGHT ||
      code == BRACE_RIGHT ||
      isSpace(code)
    )
      return srcStart;
    srcStart += 2;
  }

  return 0;
}
