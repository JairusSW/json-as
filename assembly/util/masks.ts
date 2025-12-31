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

export function mask_to_string_v128(vec: v128): string {
  let result = "0x";

  const lanes: i8[] = [
    i8x16.extract_lane_s(vec, 0),
    i8x16.extract_lane_s(vec, 1),
    i8x16.extract_lane_s(vec, 2),
    i8x16.extract_lane_s(vec, 3),
    i8x16.extract_lane_s(vec, 4),
    i8x16.extract_lane_s(vec, 5),
    i8x16.extract_lane_s(vec, 6),
    i8x16.extract_lane_s(vec, 7),
    i8x16.extract_lane_s(vec, 8),
    i8x16.extract_lane_s(vec, 9),
    i8x16.extract_lane_s(vec, 10),
    i8x16.extract_lane_s(vec, 11),
    i8x16.extract_lane_s(vec, 12),
    i8x16.extract_lane_s(vec, 13),
    i8x16.extract_lane_s(vec, 14),
    i8x16.extract_lane_s(vec, 15),
  ];

  for (let i = 15; i >= 0; i--) {
    const byte = lanes[i];
    const hi = (byte >> 4) & 0xF;
    const lo = byte & 0xF;
    result += String.fromCharCode(hi < 10 ? 48 + hi : 55 + hi);
    result += String.fromCharCode(lo < 10 ? 48 + lo : 55 + lo);
    result += " ";
  }

  return result;
}

