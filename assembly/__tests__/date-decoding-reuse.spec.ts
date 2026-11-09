// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";

describe("Review: Date JSON decoding", () => {
  const expected = Date.fromString("2025-02-03T21:28:40.525Z").getTime();
  expect(JSON.parse<Date>('  "2025-02-03T21:28:40.525Z" \r\n').getTime()).toBe(
    expected,
  );
  expect(
    JSON.parse<Date>('"2025-02-03\\u005421:28:40.525\\u005a"').getTime(),
  ).toBe(expected);
  const out = new Date(0);
  expect(JSON.parse<Date>('"2025-02-03T21:28:40.525Z"', out) === out).toBe(
    true,
  );
  expect(out.getTime()).toBe(expected);
});
