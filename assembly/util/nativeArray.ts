import { allocateObject, linkObject } from "./runtime";

/** Ordinary zero-length Array construction, specialized for its native layout. */
@inline
export function newNativeArray<T>(minimumCapacity: usize = 8): T {
  // Subclasses must run their own constructors. Other runtimes retain the
  // standard constructor, including their backing-buffer initialization.
  if (ASC_RUNTIME == 2 && sizeof<usize>() == 4 && isArray<nonnull<T>>()) {
    if (idof<nonnull<T>>() == idof<Array<valueof<nonnull<T>>>>()) {
      const out = changetype<nonnull<T>>(
        allocateObject(offsetof<nonnull<T>>(), idof<nonnull<T>>()),
      );
      // Ordinary callers keep Array's normal minimum. Generated reference-array
      // fields can reserve more slots to avoid copying managed storage on early
      // growth. This is separate from the empty-array zero-capacity path. Both
      // allocations remain managed roots and retain distinct identity.
      const bytes = max(minimumCapacity, <usize>8) << alignof<valueof<nonnull<T>>>();
      const buffer = changetype<ArrayBuffer>(
        allocateObject(bytes, idof<ArrayBuffer>()),
      );
      const ptr = changetype<usize>(out);
      const data = changetype<usize>(buffer);
      store<usize>(ptr, data, offsetof<ArrayBufferView>("buffer"));
      store<usize>(ptr, data, offsetof<ArrayBufferView>("dataStart"));
      store<i32>(ptr, <i32>bytes, offsetof<ArrayBufferView>("byteLength"));
      store<i32>(ptr, 0, offsetof<nonnull<T>>("length_"));
      linkObject(ptr, data, false);
      return changetype<T>(out);
    }
  }
  return instantiate<T>();
}

/** Append through native storage, keeping the common no-growth path local. */
@inline
export function appendNativeArray<T extends unknown[]>(
  out: T,
  item: valueof<T>,
): void {
  const ptr = changetype<usize>(out);
  // Use base-layout fields even when the instance is a subclass. Its public
  // accessors and operators do not define the parser's native storage policy.
  const index = load<i32>(ptr, offsetof<Array<valueof<T>>>("length_"));
  const shift = alignof<valueof<T>>();
  const capacity =
    load<u32>(ptr, offsetof<ArrayBufferView>("byteLength")) >> shift;
  if (<u32>index < capacity) {
    const data = load<usize>(ptr, offsetof<ArrayBufferView>("dataStart"));
    store<valueof<T>>(data + ((<usize>index) << shift), item);
    if (isManaged<valueof<T>>()) linkObject(ptr, changetype<usize>(item), true);
    store<i32>(ptr, index + 1, offsetof<Array<valueof<T>>>("length_"));
  } else {
    // The ordinary base setter retains growth, overflow checks, zeroing and
    // buffer/root barriers. Keep both managed arguments alive through it.
    changetype<Array<valueof<T>>>(out)[index] = item;
  }
}
