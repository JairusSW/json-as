// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class InputAlias {
  a: string = "";
  b: i32 = 0;
}
describe("parsing cannot reuse its own input as decoded field storage", () => {
  const text = "x".repeat(1000);
  const input = '{"a":"' + text + '","b":7}';
  const out = new InputAlias();
  out.a = input;
  JSON.parse<InputAlias>(input, out);
  expect(out.a).toBe(text);
  expect(out.b).toBe(7);
  expect(input).toBe('{"a":"' + text + '","b":7}');
  expect(JSON.parse<InputAlias>(input).a).toBe(text);
});
