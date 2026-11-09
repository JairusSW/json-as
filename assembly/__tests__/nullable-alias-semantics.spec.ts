// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
type MaybeText = string | null;


@json class AliasOwner {
  value: MaybeText = "seed";
}
describe("nullable aliases retain effective nullability", () => {
  expect(JSON.parse<AliasOwner>('{"value":null}').value == null).toBe(true);
  const out = new AliasOwner();
  JSON.parse<AliasOwner>('{"value":null}', out);
  expect(out.value == null).toBe(true);
  expect(JSON.parse<AliasOwner>("{}").value).toBe("seed");
});
