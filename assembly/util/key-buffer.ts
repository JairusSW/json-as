// A fixed u32 length handles long JSON property names without adding a
// sentinel branch to every ordinary key lookup or serialization step.
export const KEY_HEADER_UNITS: i32 = 2;


@inline
export function keyLength(ptr: usize): i32 {
  return load<i32>(ptr);
}
