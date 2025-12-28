export function mask_to_string(mask: u64): string {
  let result = "0x";
  for (let i = 7; i >= 0; i--) {
    const byte = u8((mask >> (i * 8)) & 0xFF);
    const hi = (byte >> 4) & 0xF;
    const lo = byte & 0xF;
    result += String.fromCharCode(hi < 10 ? 48 + hi : 55 + hi);
    result += String.fromCharCode(lo < 10 ? 48 + lo : 55 + lo);
    result += " ";
  }
  return result;
}
