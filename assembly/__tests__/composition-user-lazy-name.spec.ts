// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class Lazy<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}


@json class OrdinaryLazyName {
  inner: Lazy<i32> = new Lazy<i32>(7);
}
describe("unrelated Lazy classes remain ordinary objects", () => {
  expect(JSON.stringify(new OrdinaryLazyName())).toBe('{"inner":{"value":7}}');
});
