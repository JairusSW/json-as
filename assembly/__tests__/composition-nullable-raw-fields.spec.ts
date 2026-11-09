// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class NullableRawField {
  items: (JSON.Raw | null)[] = [];
}
describe("raw array fields preserve null references", () => {
  expect(JSON.parse<(JSON.Raw | null)[]>("[null,1]")[0] === null).toBe(true);
  const source = '{"items":[null,1]}';
  const fresh = JSON.parse<NullableRawField>(source);
  expect(fresh.items[0] === null).toBe(true);
  expect(fresh.items[1]!.data).toBe("1");
  const reused = new NullableRawField();
  JSON.parse<NullableRawField>(source, reused);
  expect(reused.items[0] === null).toBe(true);
});
