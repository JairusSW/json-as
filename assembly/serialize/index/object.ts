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
  // Source base + upper bound for resolving a deferred slot's value range.
  const srcBase = changetype<usize>(src._src);
  const srcEnd = srcBase + ((<usize>src._src.length) << 1);

  bs.proposeSize(4 + <u32>(srcSize - 1) * 2 + <u32>srcSize * 2);
  store<u16>(bs.offset, BRACE_LEFT);
  bs.offset += 2;

  // Walk the length-prefixed key buffer in lockstep with the value slots,
  // emitting each key straight from its slice (no per-key string
  // materialization). A still-deferred slot is copied out verbatim from the
  // source; an eager/materialized slot is serialized from its boxed bits.
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

    const slot = unchecked(vals[i]);
    if (JSON.Value.slotIsLazy(slot)) {
      const start = JSON.Value.slotPtr(slot, srcBase);
      const end = JSON.Value.slotEnd(slot, srcBase, srcEnd);
      const size = end - start;
      bs.proposeSize(size);
      memory.copy(bs.offset, start, size);
      bs.offset += size;
    } else {
      const v = JSON.Value.fromBits(slot);
      serializeArbitrary(v);
      // Persist any escape-class the serializer cached on a materialized String
      // slot back into the flat slot, so re-serializing this object reuses it
      // (the memcpy fast path) instead of re-scanning. No-op for other types.
      const nb = v.__bits();
      if (nb != slot) unchecked((vals[i] = nb));
    }
    pos += 1 + len;
    i++;
  }

  store<u16>(bs.offset, BRACE_RIGHT);
  bs.offset += 2;
}
