// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";

describe("primitive array maps compile through conversion fallback", () => {
  const map = new Map<string, i32[]>();
  map.set("items", [1, 2]);
  expect(JSON.stringify(JSON.Obj.from(map))).toBe('{"items":[1,2]}');
});
