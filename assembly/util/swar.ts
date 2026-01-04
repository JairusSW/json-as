
// @ts-ignore: decorator
@inline export function hex4_to_u16_swar(block: u64): u16 {
  // (c & 0xF) + 9 * (c >> 6)
  block = (block & 0x0F000F000F000F)
    + ((block >> 6) & 0x03000300030003) * 9;

  return <u16>(
    ((block >> 0)) << 12 |
    ((block >> 16)) << 8 |
    ((block >> 32)) << 4 |
    ((block >> 48))
  );
}