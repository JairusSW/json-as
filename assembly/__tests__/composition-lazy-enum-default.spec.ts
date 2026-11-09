// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";

enum LazyState {
  Off,
  On,
}


@json class LazyEnumDefault {
  value!: JSON.Lazy<LazyState>;
}
describe("lazy enums keep implicit scalar defaults", () => {
  const value = new LazyEnumDefault();
  expect(value.value).toBe(LazyState.Off);
  expect(JSON.stringify(value)).toBe('{"value":0}');
  expect(JSON.stringify(JSON.parse<LazyEnumDefault>("{}"))).toBe('{"value":0}');
});
