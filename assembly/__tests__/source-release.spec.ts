// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
describe("containers release replaced deferred source", () => {
  const arr = JSON.parse<JSON.Arr>('["' + "x".repeat(10000) + '"]');
  arr.set<i32>(0, 7);
  expect(arr._src.length).toBe(0);
  expect(JSON.stringify(arr)).toBe("[7]");
  const obj = JSON.parse<JSON.Obj>('{"x":"' + "x".repeat(10000) + '"}');
  obj.set<i32>("x", 7);
  expect(obj._src.length).toBe(0);
  expect(JSON.stringify(obj)).toBe('{"x":7}');
});
describe("deferred anchors survive slot mutations until the last dependency", () => {
  const arr = JSON.parse<JSON.Arr>('["first","second"]');
  arr.unshift<i32>(7);
  arr.set<i32>(1, 8);
  expect(arr._src.length > 0).toBe(true);
  expect(JSON.stringify(arr)).toBe('[7,8,"second"]');
  arr.set<i32>(2, 9);
  expect(arr._src.length).toBe(0);
  expect(JSON.stringify(arr)).toBe("[7,8,9]");
  const filled = JSON.parse<JSON.Arr>('["first","second"]');
  filled.fill<i32>(7, 0, 1);
  expect(filled._src.length > 0).toBe(true);
  filled.fill<i32>(8, 1);
  expect(filled._src.length).toBe(0);
  expect(JSON.stringify(filled)).toBe("[7,8]");
  const moved = JSON.parse<JSON.Arr>('["first",7]');
  moved.copyWithin(0, 1, 2);
  expect(moved._src.length).toBe(0);
  expect(JSON.stringify(moved)).toBe("[7,7]");
  const duplicated = JSON.parse<JSON.Arr>('[7,"last"]');
  duplicated.copyWithin(0, 1, 2);
  duplicated.set<i32>(0, 8);
  expect(duplicated._src.length > 0).toBe(true);
  expect(JSON.stringify(duplicated)).toBe('[8,"last"]');
  duplicated.length = 1;
  expect(duplicated._src.length).toBe(0);
  const split = JSON.parse<JSON.Arr>('[7,"last"]');
  const removed = split.splice(1, 1);
  expect(split._src.length).toBe(0);
  expect(removed._src.length > 0).toBe(true);
  expect(JSON.stringify(removed)).toBe('["last"]');
  removed.set<i32>(0, 9);
  expect(removed._src.length).toBe(0);
  const sliced = JSON.parse<JSON.Arr>('["first","last"]');
  const tail = sliced.slice(1);
  sliced.length = 0;
  expect(JSON.stringify(tail)).toBe('["last"]');
  tail.set<i32>(0, 9);
  expect(tail._src.length).toBe(0);
  const obj = JSON.parse<JSON.Obj>('{"a":"first","b":"last"}');
  obj.set<i32>("a", 7);
  expect(obj._src.length > 0).toBe(true);
  obj.delete("b");
  expect(obj._src.length).toBe(0);
  expect(JSON.stringify(obj)).toBe('{"a":7}');
  const nested = JSON.parse<JSON.Arr>('[{"text":"last"}]');
  const child = nested.getAs<JSON.Obj>(0);
  expect(nested._src.length).toBe(0);
  expect(JSON.stringify(child)).toBe('{"text":"last"}');
});
