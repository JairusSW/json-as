// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
let target: Owner | null = null;


@json class Owner {
  items: i32[] | null = null;
  tail: i32 = 0;
}
const retained = new Array<i32[]>();
const sink = memory.data(16);
function pressure(count: i32): void {
  for (let n = 0; n < count; n++) {
    const value = new ArrayBuffer(73 + (n & 31));
    store<usize>(sink, changetype<usize>(value));
  }
}
export function verify(): i32 {
  target = new Owner();
  __collect();
  if (JSON_PUBLICATION_TEST_FAST) assert(target!.__DESERIALIZE_FAST_ENABLED());
  for (let i = 0; i < 128; i++) {
    target!.items = null;
    target!.tail = 0;
    pressure(31 + (i & 63));
    JSON.parse<Owner>('{"items":[],"tail":7}', target!);
    // No managed child local remains live across this collection. The old owner
    // must publish its newly allocated child correctly before subsequent GC.
    pressure(47 + (i & 31));
    __collect();
    assert(
      target!.items !== null && target!.items!.length == 0 && target!.tail == 7,
    );
    retained.push(target!.items!);
  }
  target = null;
  __collect();
  for (let i = 0; i < retained.length; i++) {
    assert(retained[i].length == 0);
    if (i) assert(retained[i] !== retained[i - 1]);
  }
  return retained.length;
}
