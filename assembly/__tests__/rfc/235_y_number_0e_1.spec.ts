// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: y_number_0e+1.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_number_0e+1", () => {
  expect((): void => {
    JSON.parse<f64[]>("[0e+1]");
  }).not.toThrow();
});
