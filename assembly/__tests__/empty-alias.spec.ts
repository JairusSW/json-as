// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class EmptyAlias {

  @alias("") value: i32 = 0;
}


@json class LazyEmptyAlias {

  @alias("") value: JSON.Lazy<string> = "default";
}
describe("empty aliases are explicit wire names", () => {
  expect(JSON.stringify(new EmptyAlias())).toBe('{"":0}');
  expect(JSON.parse<EmptyAlias>('{"":7}').value).toBe(7);
  expect(JSON.parse<LazyEmptyAlias>('{"":"ok"}').value).toBe("ok");
});


@json class MixedEmptyAlias {

  @alias("") value: i32 = 0;
  other: i32 = 0;
}
describe("empty aliases participate in keyed slow dispatch", () => {
  const out = JSON.parse<MixedEmptyAlias>('{"other":9,"":7}');
  expect(out.value).toBe(7);
  expect(out.other).toBe(9);
});
