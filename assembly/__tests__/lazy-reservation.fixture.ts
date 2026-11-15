// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { bs } from "../../lib/as-bs";

@json
class LazyBudget {
  first: JSON.Lazy<string> = "";
  @optional scalar: JSON.Lazy<i32> = 7;
  @optional wide: JSON.Lazy<i64> = 8;
  @optional nullable: JSON.Lazy<string | null> = null;
  @optional flag: JSON.Lazy<bool> = true;
  @optional ratio: JSON.Lazy<f64> = 1.5;
  @optional missing!: JSON.Lazy<string | null>;
}

export function render(length: i32, materialized: bool, append: bool): string {
  const text = "x".repeat(length);
  const value = JSON.parse<LazyBudget>('{"first":"' + text + '"}');
  if (materialized) {
    assert(value.first.length == length);
    value.missing = null;
  }
  bs.reset();
  JSON.__serialize(value);
  if (append) {
    const tail = 1 << 20;
    bs.proposeSize(tail);
    assert(bs.offset - bs.buffer + tail <= bs.bufferSize,
      "The next reservation must cover the actual write cursor");
    for (let end = bs.offset + tail; bs.offset < end; bs.offset += 2) {
      store<u16>(bs.offset, 32);
    }
  }
  assert(bs.stackSize >= bs.offset - bs.buffer,
    "Lazy output bytes must remain in the reservation budget");
  return bs.out<string>();
}
