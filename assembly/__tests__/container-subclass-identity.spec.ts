// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
let constructions: i32 = 0;
class IntRows extends Array<i32> {
  constructor() {
    super();
    constructions++;
  }
}
class FloatRows extends Array<f64> {
  constructor() {
    super();
    constructions++;
  }
}
class MapRows extends Map<string, i32> {
  constructor() {
    super();
    constructions++;
  }
}
class SetRows extends Set<i32> {
  constructor() {
    super();
    constructions++;
  }
}
function runtimeId<T>(value: T): u32 {
  return changetype<OBJECT>(changetype<usize>(value) - TOTAL_OVERHEAD).rtId;
}
describe("container parsing preserves actual subtype and constructor", () => {
  constructions = 0;
  const ints = JSON.parse<IntRows>("[1,2]");
  expect(constructions).toBe(1);
  expect(runtimeId(ints)).toBe(idof<IntRows>());
  constructions = 0;
  const floats = JSON.parse<FloatRows>("[1.5]");
  expect(constructions).toBe(1);
  expect(runtimeId(floats)).toBe(idof<FloatRows>());
  constructions = 0;
  const map = JSON.parse<MapRows>('{"x":1}');
  expect(constructions).toBe(1);
  expect(runtimeId(map)).toBe(idof<MapRows>());
  constructions = 0;
  const set = JSON.parse<SetRows>("[1,2]");
  expect(constructions).toBe(1);
  expect(runtimeId(set)).toBe(idof<SetRows>());
  constructions = 0;
  const nested = JSON.parse<IntRows[]>("[[1]]");
  expect(constructions).toBe(1);
  expect(runtimeId(nested[0])).toBe(idof<IntRows>());
});
