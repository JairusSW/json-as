// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";

describe("wide matching values can be boxed without narrowing", () => {
  const signed = JSON.Value.from<i64>(9007199254740993);
  const unsigned = JSON.Value.from<u64>(u64.MAX_VALUE);
  expect(JSON.Box.fromValue<i64>(signed)!.value).toBe(<i64>9007199254740993);
  expect(JSON.Box.fromValue<u64>(unsigned)!.value).toBe(u64.MAX_VALUE);
  expect(signed.asBox<i64>()!.value).toBe(<i64>9007199254740993);
  expect(JSON.Box.fromValue<i64>(JSON.Value.from<f64>(7.0))!.value).toBe(
    <i64>7,
  );
});
