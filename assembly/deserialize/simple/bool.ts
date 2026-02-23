// @ts-ignore: inline
@inline export function deserializeBoolean(srcStart: usize, srcEnd: usize): boolean {
  const block = load<u64>(srcStart);
  if (block == 28429475166421108) return true;
  else if (block == 32370086184550502 && load<u16>(srcStart, 8) == 101) return false;
  return false; //throw new Error(`Expected to find boolean, but found "${data.slice(0, 100)}" instead!`);
}
