// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
import { PublicAlias, makePublicAlias } from "./private-alias.fixture";


@json class PublicAliasOwner {
  item: PublicAlias = makePublicAlias();
}
describe("imported aliases preserve an emitted binding", () => {
  expect(JSON.parse<PublicAliasOwner>('{"item":{"value":7}}').item.value).toBe(
    7,
  );
});
