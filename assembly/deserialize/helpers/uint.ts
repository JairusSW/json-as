export function deserializeUintScan<T extends number>(src: usize, dst: usize): usize {
  let digit = <T>load<u16>(src) - 48;
  if (digit > 9) abort("Found invalid digit");
  let val = digit;
  src += 2;
  while ((digit = <u32>load<u16>(src) - 48) < 10) {
    val = val * 10 + digit;
    src += 2;
  }
  store<T>(dst, val);
  return src;
}
