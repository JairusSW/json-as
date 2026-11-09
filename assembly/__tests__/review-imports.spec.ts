// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
import {
  ImportedReviewBase,
  ImportedSimdReviewBase,
} from "./review-import-base.fixture";
const INITIAL_COUNT: i32 = 99;


@json class ImportedReviewChild extends ImportedReviewBase {
  label: string = "child";
}


@json class ImportedSimdReviewChild extends ImportedSimdReviewBase {
  label: string = "child";
}
describe("inherited defaults retain declaring scope", () => {
  expect(JSON.parse<ImportedReviewChild>("{}").count).toBe(7);
  expect(JSON.stringify(new ImportedReviewBase())).toBe('{"count":7}');
  expect(JSON.stringify(new ImportedSimdReviewBase())).toBe('{"count":7}');
  expect(JSON.stringify(new ImportedSimdReviewChild())).toBe(
    '{"count":7,"label":"child"}',
  );
});
