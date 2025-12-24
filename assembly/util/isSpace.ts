// @ts-ignore
@inline export function isSpace(code: u16): boolean {
  return code == 0x20 || code - 9 <= 4;
}
