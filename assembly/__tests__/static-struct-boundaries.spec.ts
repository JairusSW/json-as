// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class ReviewQuotedItem {
  text: string = "";
}

describe("Review: static struct arrays scan complete quoted values", () => {
  const text = '[{"text":"}"},{"text":"{"}]';
  const values = JSON.parse<StaticArray<ReviewQuotedItem>>(text);
  expect(values.length).toBe(2);
  expect(values[0].text).toBe("}");
  expect(values[1].text).toBe("{");
  expect(JSON.stringify(values)).toBe(text);
});
