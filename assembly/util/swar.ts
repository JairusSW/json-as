/**
 * Decode four lowercase ASCII hex digits packed into UTF-16 lanes into one `u16`.
 *
 * The input is a `u64` whose four 16-bit lanes each contain one ASCII hex code
 * unit in the low byte:
 *
 * - lane 0: most-significant hex digit
 * - lane 1: next hex digit
 * - lane 2: next hex digit
 * - lane 3: least-significant hex digit
 *
 * For example, `0x0034_0033_0032_0031` represents the UTF-16 string `"1234"`
 * and decodes to `0x1234`.
 *
 * This helper assumes the digits are already valid lowercase hexadecimal
 * characters in the ranges `0-9` or `a-f`.
 *
 * @param block Packed UTF-16 ASCII hex digits.
 * @returns The decoded 16-bit value.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function hex4_to_u16_swar(block: u64): u16 {
  // (c & 0xF) + 9 * (c >> 6)
  block = (block & 0x0f000f000f000f) + ((block >> 6) & 0x03000300030003) * 9;

  return <u16>(((block >> 0) << 12) | ((block >> 16) << 8) | ((block >> 32) << 4) | (block >> 48));
}

/**
 * Encode one `u16` into four lowercase ASCII hex digits packed into UTF-16 lanes.
 *
 * The returned `u64` is laid out so it can be written directly as four UTF-16
 * code units:
 *
 * - lane 0: most-significant hex digit
 * - lane 1: next hex digit
 * - lane 2: next hex digit
 * - lane 3: least-significant hex digit
 *
 * Each lane stores the ASCII character in the low byte and zero in the high
 * byte. For example, `0x1234` becomes `0x0034_0033_0032_0031`, which
 * represents the UTF-16 string `"1234"`.
 *
 * This helper is the inverse of {@link hex4_to_u16_swar}.
 *
 * @param code The 16-bit value to encode.
 * @returns Four packed UTF-16 ASCII hex digits.
 */
// @ts-expect-error: @inline is a valid decorator
@inline export function u16_to_hex4_swar(code: u16): u64 {
  let block = (<u64>((code >> 12) & 0xf)) | ((<u64>((code >> 8) & 0xf)) << 16) | ((<u64>((code >> 4) & 0xf)) << 32) | ((<u64>(code & 0xf)) << 48);

  const alphaMask = ((block + 0x0006_0006_0006_0006) >> 4) & 0x0001_0001_0001_0001;
  block += 0x0030_0030_0030_0030 + alphaMask * 39;
  return block;
}
