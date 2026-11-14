// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";

class SeededSizedMap extends Map<string, i32> {
  constructor() {
    super();
    super.set("seed", 1);
  }
  get size(): i32 {
    return 0;
  }
}

describe("Map subclasses clear seeded storage inside arrays", () => {
  const root = JSON.parse<SeededSizedMap>('{"actual":2}');
  expect(JSON.stringify(root)).toBe('{"actual":2}');
  const rows = JSON.parse<SeededSizedMap[]>('[{"actual":2}]');
  expect(JSON.stringify(rows)).toBe('[{"actual":2}]');
  const fixed = JSON.parse<StaticArray<SeededSizedMap>>('[{"actual":2}]');
  expect(JSON.stringify(fixed)).toBe('[{"actual":2}]');
});

describe("slice shares nested references regardless of an earlier read", () => {
  for (let eager = 0; eager < 2; eager++) {
    const original = JSON.parse<JSON.Arr>('[{"n":1}]');
    if (eager) original.getAs<JSON.Obj>(0);
    const copy = original.slice();
    __collect();
    copy.getAs<JSON.Obj>(0).set<i32>("n", 2);
    expect(JSON.stringify(original)).toBe('[{"n":2}]');
    expect(original.getAs<JSON.Obj>(0) === copy.getAs<JSON.Obj>(0)).toBe(true);
  }
});

describe("concat caches shared references in both original sources", () => {
  for (let eager = 0; eager < 2; eager++) {
    const original = JSON.parse<JSON.Arr>('[{"n":1}]');
    const other = JSON.parse<JSON.Arr>('[{"n":3}]');
    if (eager) original.getAs<JSON.Obj>(0);
    const copy = original.concat(other);
    __collect();
    copy.getAs<JSON.Obj>(0).set<i32>("n", 2);
    copy.getAs<JSON.Obj>(1).set<i32>("n", 4);
    expect(JSON.stringify(original)).toBe('[{"n":2}]');
    expect(JSON.stringify(other)).toBe('[{"n":4}]');
    expect(JSON.stringify(copy)).toBe('[{"n":2},{"n":4}]');
  }
  const original = JSON.parse<JSON.Arr>('[{"n":1}]');
  const copy = original.concat(original);
  copy.getAs<JSON.Obj>(1).set<i32>("n", 2);
  expect(JSON.stringify(copy)).toBe('[{"n":2},{"n":2}]');
  expect(JSON.stringify(original)).toBe('[{"n":2}]');
});

describe("copyWithin snapshots overlapping nested references", () => {
  for (let eager = 0; eager < 2; eager++) {
    const values = JSON.parse<JSON.Arr>('[{"n":1},null]');
    if (eager) values.getAs<JSON.Obj>(0);
    values.copyWithin(1, 0, 1);
    __collect();
    values.getAs<JSON.Obj>(1).set<i32>("n", 2);
    expect(JSON.stringify(values)).toBe('[{"n":2},{"n":2}]');
  }
  const right = JSON.parse<JSON.Arr>('[{"n":1},{"n":3},null]');
  right.copyWithin(1, 0, 2);
  right.getAs<JSON.Obj>(1).set<i32>("n", 2);
  expect(JSON.stringify(right)).toBe('[{"n":2},{"n":2},{"n":3}]');
  const left = JSON.parse<JSON.Arr>('[null,{"n":1},{"n":3}]');
  left.copyWithin(0, 1, 3);
  left.getAs<JSON.Obj>(1).set<i32>("n", 4);
  expect(JSON.stringify(left)).toBe('[{"n":1},{"n":4},{"n":4}]');
});

describe("splice retains source ownership for uncopied lazy slots", () => {
  const values = JSON.parse<JSON.Arr>('[{"n":1},{"n":3}]');
  const removed = values.splice(0, 1);
  __collect();
  removed.getAs<JSON.Obj>(0).set<i32>("n", 2);
  values.getAs<JSON.Obj>(0).set<i32>("n", 4);
  expect(JSON.stringify(removed)).toBe('[{"n":2}]');
  expect(JSON.stringify(values)).toBe('[{"n":4}]');
});
