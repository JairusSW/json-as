// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class Generic<T> {
  value!: T;
}


@json class Base<T> {
  value: JSON.Lazy<T> = changetype<T>(0);
  constructor(value: T) {
    this.value = value;
  }
}


@json class Derived extends Base<string> {
  constructor() {
    super("ok");
  }
}
describe("instantiated nullability drives generic defaults", () => {
  expect(JSON.stringify(JSON.parse<Generic<string | null>>("{}"))).toBe(
    '{"value":null}',
  );
});
describe("generic inheritance preserves lazy metadata", () => {
  expect(JSON.stringify(new Base<string>("ok"))).toBe('{"value":"ok"}');
  expect(JSON.stringify(new Derived())).toBe('{"value":"ok"}');
});


@json class NumberDerived extends Base<i32> {
  constructor() {
    super(42);
  }
}
describe("generic lazy layout stays tied to its lowered declaration", () => {
  expect(JSON.stringify(new NumberDerived())).toBe('{"value":42}');
  expect(JSON.parse<Derived>('{"value":"updated"}').value).toBe("updated");
});
