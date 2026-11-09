// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: y_object_with_newlines.json  (typed as Map<string, string>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_with_newlines", () => {
  expect((): void => {
    JSON.parse<Map<string, string>>('{\u000a"a": "b"\u000a}');
  }).not.toThrow();
});
