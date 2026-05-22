import { bs } from "../../../lib/as-bs";
import { DESERIALIZE_ESCAPE_TABLE } from "../../globals/tables";

// @ts-ignore: inline
@inline function hexDigit(c: u16): u32 {
  if (c <= 0x39) return c - 0x30; // '0'-'9'
  if (c <= 0x46) return c - 0x37; // 'A'-'F'
  return c - 0x57; // 'a'-'f'
}

// @ts-ignore: inline
@inline function hex4ToU16(srcStart: usize): u16 {
  return <u16>(
    ((hexDigit(load<u16>(srcStart)) << 12) |
      (hexDigit(load<u16>(srcStart, 2)) << 8) |
      (hexDigit(load<u16>(srcStart, 4)) << 4) |
      hexDigit(load<u16>(srcStart, 6)))
  );
}

// @ts-ignore: inline
@inline export function deserializeString(
  srcStart: usize,
  srcEnd: usize,
): string {
  // Strip quotes
  srcStart += 2;
  srcEnd -= 2;
  const outStart = bs.offset - bs.buffer;
  bs.ensureSize(u32(srcEnd - srcStart));

  while (srcStart < srcEnd) {
    const block = load<u16>(srcStart);
    store<u16>(bs.offset, block);
    srcStart += 2;

    // Early exit
    if (block !== 0x5c) {
      bs.offset += 2;
      continue;
    }

    const code = load<u16>(srcStart);
    if (code !== 0x75) {
      // Short escapes (\n \t \" \\)
      const block = load<u16>(srcStart);
      const escape = load<u16>(DESERIALIZE_ESCAPE_TABLE + block);
      store<u16>(bs.offset, escape);
      srcStart += 2;
    } else {
      // Unicode escape (\uXXXX)
      const escaped = hex4ToU16(srcStart + 2);
      store<u16>(bs.offset, escaped);
      srcStart += 10;
    }

    bs.offset += 2;
  }
  return bs.sliceOut<string>(outStart);
}
