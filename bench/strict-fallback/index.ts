// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../assembly";


@json
class Record {
  name: string = "";
  values: f64[] = [];
}


@json
class CustomRecord {
  value: Record = new Record();


  @deserializer("object")
  read(data: string): CustomRecord {
    const out = new CustomRecord();
    out.value = JSON.parse<Record>(data);
    return out;
  }
}

let source = "";
const reused = new Record();
export function setup(data: string): void {
  source = data;
}
export function reuse(iterations: i32): f64 {
  let sum: f64 = 0;
  for (let i = 0; i < iterations; i++) {
    const value = JSON.parse<Record>(source, reused);
    sum += value.values.length + value.name.length + value.values[0];
  }
  return sum;
}
export function custom(iterations: i32): f64 {
  let sum: f64 = 0;
  for (let i = 0; i < iterations; i++) {
    const value = JSON.parse<CustomRecord>(source).value;
    sum += value.values.length + value.name.length + value.values[0];
  }
  return sum;
}
