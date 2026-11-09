// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: y_object_long_strings.json  (typed as Map<string, JSON.Value>)
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_object_long_strings", () => {
  expect((): void => {
    JSON.parse<Map<string, JSON.Value>>(
      '{"x":[{"id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}], "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}',
    );
  }).not.toThrow();
});
