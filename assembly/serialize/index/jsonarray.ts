import { bs } from "../../../lib/as-bs";
import { JSON } from "../..";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../custom/chars";
import { serializeArbitrary } from "./arbitrary";

export function serializeJsonArray(src: JSON.Arr): void {
  const n = src.length;

  if (n == 0) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 6094939); // "[]"
    bs.offset += 4;
    return;
  }

  const vals = src._vals;
  // Source base + upper bound for resolving a deferred slot's value range.
  const srcBase = changetype<usize>(src._src);
  const srcEnd = srcBase + ((<usize>src._src.length) << 1);

  bs.proposeSize(4 + <u32>(n - 1) * 2);
  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;

  // A still-deferred slot is copied out verbatim from the source; an
  // eager/materialized slot is serialized from its boxed bits.
  for (let i = 0; i < n; i++) {
    if (i != 0) {
      store<u16>(bs.offset, COMMA);
      bs.offset += 2;
    }
    const slot = unchecked(vals[i]);
    if (JSON.Value.slotIsLazy(slot)) {
      const start = JSON.Value.slotPtr(slot, srcBase);
      const end = JSON.Value.slotEnd(slot, srcBase, srcEnd);
      const size = end - start;
      bs.proposeSize(size);
      memory.copy(bs.offset, start, size);
      bs.offset += size;
    } else {
      serializeArbitrary(JSON.Value.fromBits(slot));
    }
  }

  store<u16>(bs.offset, BRACKET_RIGHT);
  bs.offset += 2;
}
