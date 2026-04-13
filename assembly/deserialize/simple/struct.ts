export function deserializeStruct<T>(srcStart: usize, srcEnd: usize, dst: usize): T {
  const out = changetype<nonnull<T>>(dst || __new(offsetof<T>(), idof<T>()));

  // @ts-ignore: supplied by transform
  if (isDefined(out.__INITIALIZE)) out.__INITIALIZE();
  // @ts-ignore: supplied by transform
  if (isDefined(out.__DESERIALIZE_FAST)) {
    // @ts-ignore: supplied by transform
    out.__DESERIALIZE_FAST(srcStart, srcEnd, out);
  } else {
    // @ts-ignore: supplied by transform
    out.__DESERIALIZE_SLOW(srcStart, srcEnd, out);
  }
  return out;
}
