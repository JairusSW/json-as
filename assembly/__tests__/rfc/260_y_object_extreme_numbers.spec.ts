// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: y_object_extreme_numbers.json  (typed as Map<string, f64>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_extreme_numbers", () => {
  expect((): void => {
    JSON.parse<Map<string, f64>>('{ "min": -1.0e+28, "max": 1.0e+28 }');
  }).not.toThrow();
});
