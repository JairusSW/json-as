import { bs } from "../../../lib/as-bs";
import { _intTo16 } from "../../custom/util";
import { bytes } from "../../util/bytes";
import { BACK_SLASH, QUOTE } from "../../custom/chars";
import { SERIALIZE_ESCAPE_TABLE } from "../../globals/tables";
import { serializeStruct } from "./struct";

// @ts-ignore: decorator allowed
@lazy const U00_MARKER = 13511005048209500;
// @ts-ignore: decorator allowed
@lazy const U_MARKER = 7667804;

/**
 * Serializes valid strings into their JSON counterpart
 * @param src string
 * @returns void
 */
// @ts-ignore: inline
@inline export function serializeString(src: string): void {
  const srcSize = bytes(src);
  bs.proposeSize(srcSize + 4);
  let srcPtr = changetype<usize>(src);
  const srcEnd = srcPtr + srcSize;

  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;

  let lastPtr: usize = srcPtr;
  while (srcPtr < srcEnd) {
    const code = load<u16>(srcPtr);
    srcPtr += 2;

    if (code == 34 || code == 92 || code < 32) {
      const remBytes = srcPtr - lastPtr - 2;
      memory.copy(bs.offset, lastPtr, remBytes);
      bs.offset += remBytes;
      const escaped = load<u32>(SERIALIZE_ESCAPE_TABLE + (code << 2));
      if ((escaped & 0xffff) != BACK_SLASH) {
        bs.growSize(10);
        store<u64>(bs.offset, U00_MARKER, 0);
        store<u32>(bs.offset, escaped, 8);
        bs.offset += 12;
      } else {
        bs.growSize(2);
        store<u32>(bs.offset, escaped, 0);
        bs.offset += 4;
      }
      lastPtr = srcPtr;
      continue;
    }
    // srcPtr += 2;
    if (code < 0xd800 || code > 0xdfff) continue;

    if (code <= 0xdbff) {
      if (srcPtr <= srcEnd - 2) {
        const next = load<u16>(srcPtr);
        if (next >= 0xdc00 && next <= 0xdfff) {
          srcPtr += 2;
          continue;
        }
      }
    }

    const remBytes = srcPtr - lastPtr - 2;
    memory.copy(bs.offset, lastPtr, remBytes);
    bs.offset += remBytes;

    // unpaired high/low surrogate
    bs.growSize(10);
    store<u32>(bs.offset, U_MARKER); // \u
    store<u64>(bs.offset, load<u64>(changetype<usize>(code.toString(16))), 4);
    bs.offset += 12;
    lastPtr = srcPtr;
    continue;
  }
  const remBytes = srcEnd - lastPtr;
  memory.copy(bs.offset, lastPtr, remBytes);
  bs.offset += remBytes;
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

// @ts-ignore: inline
@inline function write_u_escape(code: u16): void {
  bs.growSize(10);
  store<u32>(bs.offset, U_MARKER); // "\u"
  // write hex digits (lowercase, matches tests)
  store<u16>(bs.offset + 4, hexNibble((code >> 12) & 0xf));
  store<u16>(bs.offset + 6, hexNibble((code >> 8) & 0xf));
  store<u16>(bs.offset + 8, hexNibble((code >> 4) & 0xf));
  store<u16>(bs.offset + 10, hexNibble(code & 0xf));
  bs.offset += 12;
}

// @ts-ignore: inline
@inline function hexNibble(n: u16): u16 {
  return n < 10 ? 48 + n : 87 + n;
}
