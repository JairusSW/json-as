// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
let calls: i32 = 0;


@json
class Item {
  n: i32 = 0;


  @deserializer('number') decode(text: string): Item {
    calls++;
    // Force collection during decoding only in incremental-runtime checks.
    if (isDefined(JSON_KEY_GC_STRESS)) {
      if (JSON_KEY_GC_STRESS) __collect();
    }
    const out = new Item();
    out.n = <i32>parseInt(text);
    return out;
  }
}
// Explicit roots also retain completed results under Minimal collections.
let kept: Map<string, Item> | null = null;
const keys = ["", "a", "日本語", 'quote"', "back\\slash", "\u0000", "\u8000"];
export function verify(): i32 {
  for (let i = 0; i < 96; i++)
    keys.push("key" + i.toString() + "x".repeat(i % 96));
  const source = new Map<string, i32>();
  for (let i = 0; i < keys.length; i++) source.set(keys[i], i);
  let text = JSON.stringify(source);
  calls = 0;
  kept = JSON.parse<Map<string, Item>>(text);
  assert(calls == keys.length && kept!.size == keys.length);
  for (let round = 0; round < 16; round++) {
    const next = JSON.parse<Map<string, Item>>(text);
    for (let i = 0; i < keys.length; i++) assert(next.get(keys[i]).n == i);
  }
  assert(calls == keys.length * 17);
  text = "";
  source.clear();
  __collect();
  for (let i = 0; i < keys.length; i++) assert(kept!.get(keys[i]).n == i);
  return kept!.size;
}
