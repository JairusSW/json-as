import { BACK_SLASH, BRACE_LEFT, BRACE_RIGHT, BRACKET_LEFT, BRACKET_RIGHT, COMMA, QUOTE } from "../../../custom/chars";


@inline export function ensureArrayField<T extends Array<any>>(fieldPtr: usize): T {
  let out = load<T>(fieldPtr);
  if (!changetype<usize>(out)) {
    out = changetype<T>(instantiate<T>());
    store<T>(fieldPtr, out);
  }
  return out;
}

@inline export function ensureArrayFieldAt<T extends Array<any>>(dstObj: usize, dstOffset: usize): T {
  let out = load<T>(dstObj, dstOffset);
  if (!changetype<usize>(out)) {
    out = changetype<T>(instantiate<T>());
    store<T>(dstObj, out, dstOffset);
  }
  return out;
}


@inline function backslashOrQuoteMask(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  const q = block ^ 0x0022_0022_0022_0022;
  return (((q - 0x0001_0001_0001_0001) & ~q) | ((b - 0x0001_0001_0001_0001) & ~b)) & 0x0080_0080_0080_0080;
}


@inline export function ensureArrayElementSlot<T extends Array<any>>(out: T, index: i32): usize {
  const nextLength = index + 1;
  if (out.length < nextLength) {
    out.length = nextLength;
    const slot = out.dataStart + <usize>index * sizeof<valueof<T>>();
    // Reference arrays can allocate recursively before the caller stores the new element.
    // Zero the newly exposed slot immediately so incremental GC never observes a garbage pointer.
    if (isManaged<valueof<T>>() || isReference<valueof<T>>()) store<usize>(slot, 0);
    return slot;
  }
  return out.dataStart + <usize>index * sizeof<valueof<T>>();
}


@inline export function scanQuotedValueEnd_SWAR(srcStart: usize, srcEnd: usize): usize {
  srcStart += 2;
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;

  while (srcStart <= srcEnd8) {
    let mask = inline.always(backslashOrQuoteMask(load<u64>(srcStart)));
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

  while (srcStart < srcEnd) {
    const char = load<u16>(srcStart);
    if (char == QUOTE && load<u16>(srcStart - 2) != BACK_SLASH) return srcStart + 2;
    srcStart += 2;
  }

  return 0;
}


@inline export function scanValueEnd(srcStart: usize, srcEnd: usize): usize {
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
    if (code == COMMA || code == BRACKET_RIGHT || code == BRACE_RIGHT) return srcStart;
    srcStart += 2;
  }

  return 0;
}
