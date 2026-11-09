// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";

import { State as StateAlias } from "./composition-enum.fixture";


@json class EnumField {
  value: StateAlias = StateAlias.Off;
}
describe("renamed imported enums remain numeric", () => {
  expect(JSON.parse<StateAlias>("1")).toBe(StateAlias.On);
  expect(JSON.parse<EnumField>('{"value":1}').value).toBe(StateAlias.On);
});
