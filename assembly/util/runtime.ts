import * as runtime from "rt/common";

// Published runtimes do not reserve string metadata or expose allocation hints.
// Keep those optimizations optional so the library also works with stable AS.
export const STRING_SIZE_MASK: u32 = isDefined(runtime.STRING_SIZE_MASK)
  ? runtime.STRING_SIZE_MASK
  : u32.MAX_VALUE;
export const STRING_METADATA_MASK: u32 = isDefined(runtime.STRING_METADATA_MASK)
  ? runtime.STRING_METADATA_MASK
  : 0;


@inline
export function allocateUninitialized(size: usize, id: u32): usize {
  if (isDefined(__newUninitialized)) return __newUninitialized(size, id);
  return __new(size, id);
}
