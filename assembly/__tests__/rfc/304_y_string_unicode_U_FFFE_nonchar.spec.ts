// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: y_string_unicode_U+FFFE_nonchar.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("y_string_unicode_U+FFFE_nonchar", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uFFFE"]');
  }).not.toThrow();
});
