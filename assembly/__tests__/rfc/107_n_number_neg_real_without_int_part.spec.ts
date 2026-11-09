// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: n_number_neg_real_without_int_part.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_number_neg_real_without_int_part", () => {
  expect((): void => {
    JSON.parse<f64[]>("[-.123]");
  }).toThrow();
});
