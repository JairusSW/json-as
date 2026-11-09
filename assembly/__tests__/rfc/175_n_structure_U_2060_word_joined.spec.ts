// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: n_structure_U+2060_word_joined.json  (typed as f64[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("n_structure_U+2060_word_joined", () => {
  expect((): void => {
    JSON.parse<f64[]>("[\u2060]");
  }).toThrow();
});
