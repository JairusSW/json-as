export function deserializeBooleanArray<T extends boolean[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );
  srcStart += 2; // skip [
  while (srcStart < srcEnd) {
    const block = load<u64>(srcStart);
    if (block == 28429475166421108) {
      out.push(true);
      srcStart += 10;
    } else if (block == 32370086184550502 && load<u16>(srcStart, 8) == 101) {
      out.push(false);
      srcStart += 12;
    } else {
      srcStart += 2;
    }
  }
  return out;
}
