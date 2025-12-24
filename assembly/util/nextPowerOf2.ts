// @ts-ignore: Decorator valid here
@inline export function nextPowerOf2(n: u32): u32 {
  return 1 << (32 - clz(n - 1));
}
