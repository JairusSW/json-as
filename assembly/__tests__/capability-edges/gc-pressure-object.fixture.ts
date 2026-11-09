// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
class Values extends Array<JSON.Value> {}
function source(): JSON.Value[] {
  return [JSON.Value.from<i32>(1), JSON.Value.from<i32>(2)];
}
export function run(append: bool): string {
  __collect();
  const object = new JSON.Obj();
  if (append) {
    const key = "key";
    object.appendRaw(
      changetype<usize>(key),
      changetype<usize>(key) + 6,
      source(),
    );
  } else object.set("key", source());
  return JSON.stringify(object.getAs<Values>("key"));
}
