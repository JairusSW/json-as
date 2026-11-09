// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: i_string_utf16LE_no_BOM.json  (typed as string[])
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("i_string_utf16LE_no_BOM", () => {
  expect((): void => {
    JSON.parse<string[]>('[\u0000"\u0000\ufffd\u0000"\u0000]\u0000');
  }).not.toThrow();
});
