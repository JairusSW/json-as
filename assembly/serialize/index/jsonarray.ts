// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bs } from "../../../lib/as-bs";
import { JSON } from "../..";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../custom/chars";
import { serializeArbitrary } from "./arbitrary";
import { serializePrimitiveSlot } from "./primitive";

export function serializeJsonArray(src: JSON.Arr): void {
  const n = src.length;

  if (n == 0) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 6094939); // "[]"
    bs.offset += 4;
    return;
  }

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
    const slot =
      i < src.length ? unchecked(src._vals[i]) : JSON.Value.nullBits();
    if (JSON.Value.slotIsLazy(slot)) {
      const source = src._src;
      const srcBase = changetype<usize>(source);
      const srcEnd = srcBase + ((<usize>source.length) << 1);
      const start = JSON.Value.slotPtr(slot, srcBase);
      const end = JSON.Value.slotEnd(slot, srcBase, srcEnd);
      const size = end - start;
      bs.proposeSize(u32(size));
      memory.copy(bs.offset, start, size);
      bs.offset += size;
    } else if (!serializePrimitiveSlot(slot)) {
      const v = JSON.Value.fromBits(slot);
      serializeArbitrary(v);
    }
  }

  store<u16>(bs.offset, BRACKET_RIGHT);
  bs.offset += 2;
}
