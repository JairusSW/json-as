// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class CastDefault {
  value: i32 = <i8>257;
}
describe("default shortcut respects casts", () => {
  expect(new CastDefault().value).toBe(1);
  expect(JSON.parse<CastDefault>('{"value":257}').value).toBe(257);
  expect(JSON.parse<CastDefault>('{"value":258}').value).toBe(258);
  const out = new CastDefault();
  expect(JSON.parse<CastDefault>('{"value":257}', out).value).toBe(257);
});
