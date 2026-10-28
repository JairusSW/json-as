import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

// StaticArray length is encoded in the managed object's payload size. A reused
// destination must be resized before any unchecked element stores.
export function resizeStaticArray<T extends StaticArray<any>>(
  dst: usize,
  length: i32,
): T {
  const bytes = <usize>length * sizeof<valueof<T>>();
  if (!dst) return changetype<T>(__new(bytes, idof<T>()));
  const oldBytes = changetype<OBJECT>(dst - TOTAL_OVERHEAD).rtSize;
  if (oldBytes != <u32>bytes) {
    dst = __renew(dst, bytes);
    // In-place regrowth exposes the old allocation's untraced tail. Clear it
    // before decoding an element can allocate and trigger the GC visitor.
    if (isReference<valueof<T>>() && bytes > oldBytes)
      memory.fill(dst + oldBytes, 0, bytes - oldBytes);
  }
  return changetype<T>(dst);
}
