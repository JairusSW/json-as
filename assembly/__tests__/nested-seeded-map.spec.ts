// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
class SeededRows extends Map<string, i32> {
  constructor() {
    super();
    this.set("seed", 99);
  }
}
describe("seeded map replacement composes through arrays", () => {
  expect(JSON.parse<SeededRows>('{"x":1}').size).toBe(1);
  expect(JSON.parse<SeededRows[]>('[{"x":1}]')[0].size).toBe(1);
  expect(JSON.parse<SeededRows[]>("[{}]")[0].size).toBe(0);
  expect(JSON.parse<StaticArray<SeededRows>>('[{"x":1}]')[0].size).toBe(1);
});
