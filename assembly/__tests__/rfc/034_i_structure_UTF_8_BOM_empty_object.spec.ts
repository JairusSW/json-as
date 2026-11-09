// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// RFC8259 / JSONTestSuite: i_structure_UTF-8_BOM_empty_object.json  (typed as OAll)
import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class OAll {
  a: string = "";
  n: f64 = 0;
  b: bool = false;
  arr: f64[] = [];
  obj: OAll | null = null;
}

// Implementation-defined case: a leading BOM is not part of the JSON grammar.
describe("i_structure_UTF-8_BOM_empty_object", () => {
  expect((): void => {
    JSON.parse<OAll>("\ufeff{}");
  }).toThrow();
});
