// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class NullableRows {
  rows: (JSON.Value | null)[][] = [];
}
describe("nested dynamic values preserve null references", () => {
  const direct = JSON.parse<(JSON.Value | null)[]>("[null,1]");
  expect(direct[0] === null).toBe(true);
  const nested = JSON.parse<(JSON.Value | null)[][]>("[[null,1]]");
  expect(nested[0][0] === null).toBe(true);
  const reuse = new Array<(JSON.Value | null)[]>();
  JSON.parse<(JSON.Value | null)[][]>("[[null,1]]", reuse);
  expect(reuse[0][0] === null).toBe(true);
  const fixed = JSON.parse<StaticArray<(JSON.Value | null)[]>>("[[null,1]]");
  expect(fixed[0][0] === null).toBe(true);
  const field = JSON.parse<NullableRows>('{"rows":[[null,1]]}');
  expect(field.rows[0][0] === null).toBe(true);
});
