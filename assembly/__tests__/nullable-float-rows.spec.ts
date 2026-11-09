// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class FloatRows {
  rows: (f64[] | null)[] = [];
}
describe("nullable float rows preserve nulls and reuse", () => {
  const source = '{"rows":[null,[1.5],null,[]]}';
  const out = new FloatRows();
  expect(JSON.stringify(JSON.parse<FloatRows>(source))).toBe(source);
  JSON.parse<FloatRows>(source, out);
  expect(JSON.stringify(out)).toBe(source);
  JSON.parse<FloatRows>('{"rows":[[2.5],null,[]]}', out);
  expect(JSON.stringify(out)).toBe('{"rows":[[2.5],null,[]]}');
});
