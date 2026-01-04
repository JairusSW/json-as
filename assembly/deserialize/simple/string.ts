import { bs } from "../../../lib/as-bs";
import { DESERIALIZE_ESCAPE_TABLE, ESCAPE_HEX_TABLE } from "../../globals/tables";
import { hex4_to_u16_swar } from "../../util/swar";

// @ts-ignore: inline
@inline export function deserializeString(srcStart: usize, srcEnd: usize): string {
  // Strip quotes
  srcStart += 2;
  srcEnd -= 2;
  bs.proposeSize(u32(srcEnd - srcStart));

  while (srcStart < srcEnd) {
    const block = load<u16>(srcStart);
    store<u16>(bs.offset, block);
    srcStart += 2;

    // Early exit
    if (block !== 0x5C) {
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
      const block = load<u64>(srcStart, 2); // XXXX
      const escaped = hex4_to_u16_swar(block);
      store<u16>(bs.offset, escaped);
      srcStart += 10;
    }

    bs.offset += 2;
  }
  return bs.out<string>();
}
