import { bs } from "../../../lib/as-bs";
import { JSON } from "../..";
import { BRACE_LEFT, BRACE_RIGHT, COLON, COMMA } from "../../custom/chars";
import { serializeArbitrary } from "./arbitrary";
import { serializeStringRange } from "../naive/string";

export function serializeObject(src: JSON.Obj): void {
  const srcSize = src.size;

  if (srcSize == 0) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 8192123);
    bs.offset += 4;
    return;
  }

  const vals = src._vals;
  const kbuf = changetype<usize>(src._kbuf);
  const kused = src._kused;

  bs.proposeSize(4 + <u32>(srcSize - 1) * 2 + <u32>srcSize * 2);
  store<u16>(bs.offset, BRACE_LEFT);
  bs.offset += 2;

  // Walk the length-prefixed key buffer in lockstep with the values, emitting
  // each key straight from its slice (no per-key string materialization).
  let pos = 0;
  let i = 0;
  while (pos < kused) {
    const len = <i32>load<u16>(kbuf + ((<usize>pos) << 1));
    if (i != 0) {
      store<u16>(bs.offset, COMMA);
      bs.offset += 2;
    }
    serializeStringRange(kbuf + ((<usize>(pos + 1)) << 1), (<usize>len) << 1);
    store<u16>(bs.offset, COLON);
    bs.offset += 2;
    serializeArbitrary(unchecked(vals[i]));
    pos += 1 + len;
    i++;
  }

  store<u16>(bs.offset, BRACE_RIGHT);
  bs.offset += 2;
}
