import { BACK_SLASH, QUOTE } from "../custom/chars";

// @ts-ignore
@inline export function isUnescapedQuote(ptr: usize): bool {
  if (load<u16>(ptr) != QUOTE) return false;

  let escaped = false;
  while (ptr >= 2 && load<u16>(ptr - 2) == BACK_SLASH) {
    escaped = !escaped;
    ptr -= 2;
  }

  return !escaped;
}

// @ts-ignore
@inline export function scanStringEnd(ptr: usize, end: usize): usize {
  ptr += 2;
  while (ptr < end) {
    if (load<u16>(ptr) == QUOTE && isUnescapedQuote(ptr)) return ptr;
    ptr += 2;
  }
  return end;
}
