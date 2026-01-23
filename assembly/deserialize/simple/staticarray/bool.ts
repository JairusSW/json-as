export function deserializeStaticArrayBoolean<T extends StaticArray<any>>(srcStart: usize, srcEnd: usize, dst: usize): T {
  // First pass: count elements using same logic as Array deserializer
  let count: i32 = 0;
  let ptr = srcStart + 2; // skip [
  while (ptr < srcEnd) {
    const block = load<u64>(ptr);
    if (block == 28429475166421108) {
      count++;
      ptr += 10;
    } else if (block == 32370086184550502 && load<u16>(ptr, 8) == 101) {
      count++;
      ptr += 12;
    } else {
      ptr += 2;
    }
  }

  // Allocate StaticArray with correct size
  const outSize = <usize>count << alignof<valueof<T>>();
  const out = changetype<nonnull<T>>(dst || __new(outSize, idof<T>()));

  // Second pass: populate values
  let index = 0;
  srcStart += 2; // skip [
  while (srcStart < srcEnd) {
    const block = load<u64>(srcStart);
    if (block == 28429475166421108) {
      unchecked((out[index++] = <valueof<T>>true));
      srcStart += 10;
    } else if (block == 32370086184550502 && load<u16>(srcStart, 8) == 101) {
      unchecked((out[index++] = <valueof<T>>false));
      srcStart += 12;
    } else {
      srcStart += 2;
    }
  }

  return out;
}
