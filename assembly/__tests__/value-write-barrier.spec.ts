// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
let root = JSON.Value.from<i32>(0);
function assign(i: i32): void {
  root.set<string>("payload-" + i.toString());
}
function assignWide(i: i32): void {
  root.set<i64>(i64.MAX_VALUE - i);
}
function churn(): void {
  for (let j = 0; j < 32; j++) {
    const a = new Array<i32>(1024);
    a[0] = j;
  }
}
describe("Value pointer writes survive ongoing incremental collection", () => {
  for (let i = 0; i < 2000; i++) {
    assign(i);
    churn();
    expect(root.get<string>()).toBe("payload-" + i.toString());
  }
  for (let i = 0; i < 1000; i++) {
    assignWide(i);
    churn();
    expect(root.get<i64>()).toBe(i64.MAX_VALUE - i);
  }
});
