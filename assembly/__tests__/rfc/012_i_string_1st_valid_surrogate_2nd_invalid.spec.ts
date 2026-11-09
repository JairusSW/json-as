// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: i_string_1st_valid_surrogate_2nd_invalid.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_1st_valid_surrogate_2nd_invalid", () => {
  expect((): void => {
    JSON.parse<string[]>('["\\uD888\\u1234"]');
  }).not.toThrow();
});
