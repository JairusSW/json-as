// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";


@json class ReusedRow {
  n: i32 = 0;
}


@json class DynamicRows {
  rows: ReusedRow[] = [];
}


@json class FixedRows {
  rows: StaticArray<ReusedRow> = [];
}
const dynamic = new DynamicRows();
const fixed = new FixedRows();
let source = "";
export function setup(length: i32): void {
  let rows = "[";
  for (let i = 0; i < length; i++) {
    if (i) rows += ",";
    rows += '{\"n\":' + i.toString() + "}";
  }
  source = '{"rows":' + rows + "]}";
}
export function run(kind: i32): i32 {
  if (kind == 0) {
    JSON.parse<DynamicRows>(source, dynamic);
    return dynamic.rows.length;
  }
  JSON.parse<FixedRows>(source, fixed);
  return fixed.rows.length;
}
export function first(kind: i32): usize {
  return kind == 0
    ? changetype<usize>(dynamic.rows[0])
    : changetype<usize>(fixed.rows[0]);
}

export function checksum(kind: i32): i32 {
  let sum = 0;
  if (kind == 0) {
    for (let i = 0; i < dynamic.rows.length; i++) sum += dynamic.rows[i].n;
  } else {
    for (let i = 0; i < fixed.rows.length; i++) sum += fixed.rows[i].n;
  }
  return sum;
}
