// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class Child {
  n: i32 = 0;
}


@json class Holder {
  a: Child = new Child();
  b: Map<string, Child> = new Map();
}


@json class StaticFields {
  a: StaticArray<i32> = [9];
  b: StaticArray<i32> = [9];
}
describe("reuse ownership crosses field and collection boundaries", () => {
  const out = new Holder();
  out.b.set("x", out.a);
  JSON.parse<Holder>('{"a":{"n":1},"b":{"x":{"n":2}}}', out);
  expect(out.a.n).toBe(1);
  expect(out.b.get("x").n).toBe(2);
  const lists = new StaticFields();
  lists.b = lists.a;
  JSON.parse<StaticFields>('{"a":[1],"b":[2]}', lists);
  expect(JSON.stringify(lists)).toBe('{"a":[1],"b":[2]}');
});

describe("map claims survive reordered keys and fields", () => {
  const out = new Holder();
  out.b.set("x", out.a);
  out.b.set("y", new Child());
  JSON.parse<Holder>('{"a":{"n":1},"b":{"y":{"n":3},"x":{"n":2}}}', out);
  expect(out.a.n).toBe(1);
  expect(out.b.get("x").n).toBe(2);
});
