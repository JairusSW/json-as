import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

// StaticArray length is encoded in the managed object's payload size. A reused
// destination must be resized before any unchecked element stores.
export function resizeStaticArray<T extends StaticArray<any>>(
  dst: usize,
  length: i32,
): T {
  const bytes = <usize>length * sizeof<valueof<T>>();
  if (!dst) return changetype<T>(__new(bytes, idof<T>()));
  if (changetype<OBJECT>(dst - TOTAL_OVERHEAD).rtSize != <u32>bytes)
    dst = __renew(dst, bytes);
  return changetype<T>(dst);
}
