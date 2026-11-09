// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";

describe("wide unsigned getType compiles", () => {
  expect(JSON.Value.empty().getType<u64>(42)).toBe(JSON.Types.U64);
  expect(JSON.Value.empty().getType<usize>(0)).toBe(JSON.Types.Null);
});
