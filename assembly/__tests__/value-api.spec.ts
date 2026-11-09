// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class PolyBase {
  value: i32 = 1;
}


@json class PolyChild extends PolyBase {
  name: string = "child";
}
describe("Value adopts another Value", () => {
  const v = JSON.Value.from<i32>(1);
  v.set<JSON.Value>(JSON.Value.from<i32>(2));
  expect(JSON.stringify(v)).toBe("2");
  const text = JSON.Value.from<string>('a"b\n\\c');
  expect(text.toString()).toBe(JSON.stringify(text));
  const map = new Map<string, JSON.Value>();
  map.set("key", JSON.Value.from<i32>(2));
  const mapped = JSON.Value.from(map);
  expect(mapped.toString()).toBe(JSON.stringify(mapped));
});
describe("boxed base references use runtime serialization", () => {
  const value: PolyBase = new PolyChild();
  expect(JSON.stringify(JSON.Value.from<PolyBase>(value))).toBe(
    JSON.stringify<PolyBase>(value),
  );
});
