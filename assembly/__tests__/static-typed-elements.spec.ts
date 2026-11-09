// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";

describe("static arrays accept ordinary typed-array elements", () => {
  const value = JSON.parse<StaticArray<Uint8Array>>("[[7,8]]");
  expect(value[0][0]).toBe(<u8>7);
  expect(value[0][1]).toBe(<u8>8);
});
