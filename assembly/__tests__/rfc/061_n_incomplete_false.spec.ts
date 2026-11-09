// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: n_incomplete_false.json  (typed as bool[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_incomplete_false", () => {
  expect((): void => {
    JSON.parse<bool[]>("[fals]");
  }).toThrow();
});
