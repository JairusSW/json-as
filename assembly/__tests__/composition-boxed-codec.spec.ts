// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class CustomBox extends JSON.Box<i32> {
  constructor() {
    super(7);
  }


  @serializer encode(_self: CustomBox): string {
    return '"seven"';
  }
}
describe("dynamic boxes honor custom wire formats", () => {
  const value = new CustomBox();
  expect(JSON.Value.empty().getType(value)).toBe(JSON.Value.from(value).type);
  expect(JSON.stringify(value)).toBe('"seven"');
  expect(JSON.stringify<CustomBox[]>([value])).toBe('["seven"]');
  expect(JSON.stringify(JSON.Value.from(value))).toBe('"seven"');
  const obj = new JSON.Obj();
  obj.set("value", value);
  expect(JSON.stringify(obj)).toBe('{"value":"seven"}');
  const arr = new JSON.Arr();
  arr.push(value);
  expect(JSON.stringify(arr)).toBe('["seven"]');
  expect(JSON.stringify(JSON.Value.from(JSON.Box.from<i32>(7)))).toBe("7");
});
