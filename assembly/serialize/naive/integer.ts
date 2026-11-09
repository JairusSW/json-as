// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bs } from "../../../lib/as-bs";
import { ensureItoaPairs, itoaFast } from "../../util/itoa-fast";

export function serializeIntegerUnsafe<T extends number>(data: T): void {
  bs.offset = serializeIntegerAt<T>(bs.offset, data);
}

// @ts-expect-error: @inline is an AssemblyScript decorator
@inline export function serializeIntegerAt<T extends number>(
  dst: usize,
  data: T,
): usize {
  ensureItoaPairs();
  const charsWritten = itoaFast<T>(dst, data);
  return dst + ((<usize>charsWritten) << 1);
}
export function serializeInteger<T extends number>(data: T): void {
  ensureItoaPairs();
  bs.ensureSize(sizeof<T>() << 3);
  const charsWritten = itoaFast<T>(bs.offset, data);
  bs.growSize((<u32>charsWritten) << 1);
  bs.offset += (<usize>charsWritten) << 1;
}
