// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
type MaybeText = string | null;


@json class AliasOmission {

  @omitnull value: MaybeText = null;
}
describe("nullable aliases support omission", () => {
  expect(JSON.stringify(new AliasOmission())).toBe("{}");
  expect(JSON.stringify(JSON.parse<AliasOmission>('{"value":"x"}'))).toBe(
    '{"value":"x"}',
  );
});
