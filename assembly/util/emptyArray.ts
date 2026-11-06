import { allocateObject } from "./runtime";

// A zero-capacity buffer has no mutable bytes. Each array still has its own
// header and identity. The ordinary Array grow path renews this static buffer
// into an independent heap allocation before the first element is stored.
// This is the standard wasm32 static managed-object header: allocator size,
// pinned GC color, previous link, runtime id, logical size. Padding aligns the
// payload and the allocator pointer, just like compiler-emitted static objects.
const EMPTY_ARRAY_BUFFER: usize =
  memory.data<u32>([0, 0, 0, 16, 3, 0, idof<ArrayBuffer>(), 0], 16) + 32;


@inline
export function newEmptyArray<T extends unknown[]>(): T {
  // A subtype must run its constructor, including any extra initializers.
  // Other pointer layouts use their normal constructor.
  if (sizeof<usize>() != 4 || idof<T>() != idof<Array<valueof<T>>>()) {
    return instantiate<T>();
  }
  const result = changetype<T>(allocateObject(offsetof<T>(), idof<T>()));
  const ptr = changetype<usize>(result);
  store<usize>(ptr, EMPTY_ARRAY_BUFFER, offsetof<ArrayBufferView>("buffer"));
  store<usize>(ptr, EMPTY_ARRAY_BUFFER, offsetof<ArrayBufferView>("dataStart"));
  store<i32>(ptr, 0, offsetof<ArrayBufferView>("byteLength"));
  store<i32>(ptr, 0, offsetof<T>("length_"));
  return result;
}
