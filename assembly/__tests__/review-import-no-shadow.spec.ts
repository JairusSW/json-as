// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
import { ImportedReviewBase } from "./review-import-base.fixture";


@json class UnshadowedChild extends ImportedReviewBase {
  label: string = "child";
}
describe("inherited defaults can reference private names absent in this module", () => {
  expect(JSON.parse<UnshadowedChild>("{}").count).toBe(7);
});
