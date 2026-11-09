// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: i_object_key_lone_2nd_surrogate.json  (typed as Map<string, f64>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_object_key_lone_2nd_surrogate", () => {
  expect((): void => {
    JSON.parse<Map<string, f64>>('{"\\uDFAA":0}');
  }).not.toThrow();
});
