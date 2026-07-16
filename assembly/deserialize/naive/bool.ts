// 0 = invalid, 1 = false, 2 = true. The status form lets public dispatchers
// raise malformed-input errors at their catchable boundary without rescanning.
export function deserializeBooleanCode(srcStart: usize, srcEnd: usize): u32 {
  const length = srcEnd - srcStart;
  if (length >= 8 && load<u64>(srcStart) == 28429475166421108) return 2;
  if (
    length >= 10 &&
    load<u64>(srcStart) == 32370086184550502 &&
    load<u16>(srcStart, 8) == 101
  )
    return 1;
  return 0;
}

export function deserializeBoolean(srcStart: usize, srcEnd: usize): boolean {
  const code = deserializeBooleanCode(srcStart, srcEnd);
  if (code != 0) return code == 2;
  throw new Error("Expected 'true' or 'false' in JSON");
}
