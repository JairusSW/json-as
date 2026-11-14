// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON as Json } from "json-as";


@json class RawOwner {
  value: Json.Raw = Json.Raw.from("99");
}


@json class ValueOwner {
  value: Json.Value = Json.Value.from<i32>(99);
}
export function run(): string {
  const a = Json.parse<RawOwner>('{"value":7}', new RawOwner());
  const b = Json.parse<ValueOwner>('{"value":7}', new ValueOwner());
  return Json.stringify(a) + ":" + Json.stringify(b);
}
