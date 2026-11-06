import { allocateObject } from "./runtime";

/** Ordinary zero-length Array construction, specialized for its native layout. */
@inline
export function newNativeArray<T>(): T {
  // Subclasses must run their own constructors. Other runtimes retain the
  // standard constructor, including their backing-buffer initialization.
  if (ASC_RUNTIME == 2 && sizeof<usize>() == 4 && isArray<nonnull<T>>()) {
    if (idof<nonnull<T>>() == idof<Array<valueof<nonnull<T>>>>()) {
      const out = changetype<nonnull<T>>(
        allocateObject(offsetof<nonnull<T>>(), idof<nonnull<T>>()),
      );
      // Match Array's normal minimum capacity; this is not the empty-array
      // parser's separate zero-capacity optimization. Both allocations remain
      // managed roots across allocation/collection and retain distinct identity.
      const bytes = (<usize>8) << alignof<valueof<nonnull<T>>>();
      const buffer = changetype<ArrayBuffer>(
        allocateObject(bytes, idof<ArrayBuffer>()),
      );
      const ptr = changetype<usize>(out);
      const data = changetype<usize>(buffer);
      store<usize>(ptr, data, offsetof<ArrayBufferView>("buffer"));
      store<usize>(ptr, data, offsetof<ArrayBufferView>("dataStart"));
      store<i32>(ptr, <i32>bytes, offsetof<ArrayBufferView>("byteLength"));
      store<i32>(ptr, 0, offsetof<nonnull<T>>("length_"));
      __link(ptr, data, false);
      return changetype<T>(out);
    }
  }
  return instantiate<T>();
}
