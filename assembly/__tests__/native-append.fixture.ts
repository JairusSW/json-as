// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { appendNativeArray, newNativeArray } from "../util/nativeArray";
import { newEmptyArray } from "../util/emptyArray";


@json
class Row {
  n: i32 = 0;
}

let pushes: i32 = 0;
let setters: i32 = 0;
class Rows extends Array<Row> {
  tag: i32 = 37;
  push(value: Row): i32 {
    pushes++;
    value.n += 100;
    return super.push(value);
  }

  @operator("[]=")
  assign(index: i32, value: Row): void {
    setters++;
    value.n += 1000;
    changetype<Array<Row>>(this)[index] = value;
  }
}
class Labels extends Array<string | null> {
  tag: i32 = 43;
  push(value: string | null): i32 {
    pushes++;
    return super.push("changed");
  }

  @operator("[]=")
  assign(index: i32, value: string | null): void {
    setters++;
    changetype<Array<string | null>>(this)[index] = "changed";
  }
}

@json
class Owner {
  rows!: Row[];
  labels!: (string | null)[];
}

function scalar<T extends number>(): void {
  const values = newNativeArray<Array<T>>();
  __pin(changetype<usize>(values));
  for (let i = 0; i < 257; i++) appendNativeArray(values, <T>(i ^ 73));
  __collect();
  for (let i = 0; i < 257; i++) assert(values[i] == <T>(i ^ 73));
  __unpin(changetype<usize>(values));
}
export function storage(): i32 {
  scalar<i8>();
  scalar<u8>();
  scalar<i16>();
  scalar<u16>();
  scalar<i32>();
  scalar<u32>();
  scalar<i64>();
  scalar<u64>();
  scalar<f32>();
  scalar<f64>();
  const values = newEmptyArray<Array<Row | null>>();
  __pin(changetype<usize>(values));
  for (let i = 0; i < 129; i++) {
    const value = new Row();
    value.n = i;
    __pin(changetype<usize>(value));
    appendNativeArray(values, value);
    if (i == 0) appendNativeArray(values, value);
    __unpin(changetype<usize>(value));
    if ((i & 7) == 0) __collect();
  }
  appendNativeArray(values, changetype<Row | null>(0));
  __collect();
  assert(values[0] === values[1]);
  for (let i = 1; i < 130; i++) assert(values[i]!.n == i - 1);
  assert(values[130] === null);
  __unpin(changetype<usize>(values));
  return 1;
}

export function parser(): i32 {
  const counts = [1, 7, 8, 9, 15, 16, 17, 31, 32, 33, 65];
  __pin(changetype<usize>(counts));
  for (let c = 0; c < counts.length; c++) {
    const count = counts[c];
    let source = '{"rows":[';
    for (let i = 0; i < count; i++) {
      if (i) source += ",";
      source += '{"n":' + i.toString() + "}";
    }
    source += '],"labels":[';
    for (let i = 0; i < count; i++) {
      if (i) source += ",";
      source += (i & 1) == 0 ? "null" : '"text"';
    }
    source += "]}";
    // Minimal collects only explicit roots; source is used again after the
    // fresh-output collection below.
    __pin(changetype<usize>(source));
    const fresh = JSON.parse<Owner>(source);
    __pin(changetype<usize>(fresh));
    __collect();
    assert(fresh.rows.length == count && fresh.labels.length == count);
    for (let i = 0; i < count; i++) assert(fresh.rows[i].n == i);
    const owner = new Owner();
    __pin(changetype<usize>(owner));
    owner.rows = new Rows();
    owner.labels = new Labels();
    const rows = owner.rows;
    const labels = owner.labels;
    pushes = setters = 0;
    const parsed = JSON.parse<Owner>(source, owner);
    __collect();
    assert(
      parsed === owner && parsed.rows === rows && parsed.labels === labels,
    );
    assert(changetype<Rows>(rows).tag == 37);
    assert(changetype<Labels>(labels).tag == 43);
    assert(pushes == 0 && setters == 0);
    assert(rows.length == count && labels.length == count);
    for (let i = 0; i < count; i++) {
      assert(rows[i].n == i);
      assert((i & 1) == 0 ? labels[i] === null : labels[i] == "text");
    }
    JSON.parse<Owner>('{"rows":[],"labels":[]}', owner);
    assert(owner.rows.length == 0 && owner.labels.length == 0);
    assert(fresh.rows.length == count && fresh.rows !== rows);
    for (let i = 0; i < count; i++) assert(fresh.rows[i].n == i);
    __unpin(changetype<usize>(fresh));
    __unpin(changetype<usize>(owner));
    __unpin(changetype<usize>(source));
  }
  __unpin(changetype<usize>(counts));
  return 1;
}

// Exercise fresh managed storage across the initial capacity and later growth.
export function managedStorage(): i32 {
  const rows = newNativeArray<Array<Row | null>>(16);
  __pin(changetype<usize>(rows));
  for (let i = 0; i < 65; i++) {
    const row = new Row(); row.n = i;
    __pin(changetype<usize>(row));
    appendNativeArray(rows, row);
    __unpin(changetype<usize>(row));
    if ((i & 7) == 0 || i == 15 || i == 16 || i == 31 || i == 32) __collect();
  }
  appendNativeArray(rows, changetype<Row | null>(0));
  appendNativeArray(rows, rows[0]);
  __collect();
  assert(rows.length == 67 && rows[65] === null && rows[66] === rows[0]);
  for (let i = 0; i < 65; i++) assert(rows[i]!.n == i);
  __unpin(changetype<usize>(rows));
  return 1;
}

let prepared = newNativeArray<Row[]>();
let item = new Row();
export function noGrowth(): i32 {
  appendNativeArray(prepared, item);
  return prepared.length;
}
