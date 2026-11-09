// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { linkObject } from "../../../util/runtime";
import { scanJSONString } from "../../../util/validateJson";
import { isSpace } from "../../../util";
import { NULL_WORD_U64 } from "../../../custom/chars";
import { resizeStaticArray } from "../../../util/resizeStaticArray";
import { deserializeStringField_SWAR } from "../../swar/string";
import { markProductionParseError } from "../../error";

/** Count structural slots before resizing, then decode into the final storage.
 * Existing strings participate in the same ownership checks as dynamic fields. */
export function deserializeStaticArrayString<T extends StaticArray<any>>(
  start: usize,
  end: usize,
  dst: usize,
): T {
  while (end > start && isSpace(load<u16>(end - 2))) end -= 2;
  if (end < start + 4 || load<u16>(start) != 91 || load<u16>(end - 2) != 93)
    return fail<T>();
  const last = end - 2;
  let cursor = start + 2;
  let length = 0;
  while (cursor < last && isSpace(load<u16>(cursor))) cursor += 2;
  while (cursor < last) {
    if (load<u16>(cursor) == 34) {
      const next = scanJSONString(cursor, last);
      if (!next) return fail<T>();
      cursor = next;
    } else if (
      isNullable<valueof<T>>() &&
      cursor + 8 <= last &&
      load<u64>(cursor) == NULL_WORD_U64
    ) {
      cursor += 8;
    } else return fail<T>();
    length++;
    while (cursor < last && isSpace(load<u16>(cursor))) cursor += 2;
    if (cursor == last) break;
    if (load<u16>(cursor) != 44) return fail<T>();
    cursor += 2;
    while (cursor < last && isSpace(load<u16>(cursor))) cursor += 2;
    if (cursor == last) return fail<T>();
  }
  const out = resizeStaticArray<T>(dst, length);
  // Fresh reference slots must be safe for collection during string decoding.
  if (!dst)
    memory.fill(
      changetype<usize>(out),
      0,
      <usize>length * sizeof<valueof<T>>(),
    );
  cursor = start + 2;
  for (let index = 0; index < length; index++) {
    while (cursor < last && isSpace(load<u16>(cursor))) cursor += 2;
    const slot = changetype<usize>(out) + <usize>index * sizeof<valueof<T>>();
    if (isNullable<valueof<T>>() && load<u16>(cursor) == 110) {
      store<usize>(slot, 0);
      cursor += 8;
    } else {
      cursor = deserializeStringField_SWAR<valueof<T>>(cursor, last, slot);
      if (!cursor) return fail<T>();
      linkObject(changetype<usize>(out), load<usize>(slot), false);
    }
    while (cursor < last && isSpace(load<u16>(cursor))) cursor += 2;
    if (index + 1 < length) cursor += 2; // Commas were checked in the first pass.
  }
  return out;
}

function fail<T>(): T {
  markProductionParseError();
  return changetype<T>(0);
}
