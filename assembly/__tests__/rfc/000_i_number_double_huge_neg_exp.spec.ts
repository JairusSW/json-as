// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: i_number_double_huge_neg_exp.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_number_double_huge_neg_exp", () => {
  expect((): void => {
    JSON.parse<f64[]>("[123.456e-789]");
  }).not.toThrow();
});
