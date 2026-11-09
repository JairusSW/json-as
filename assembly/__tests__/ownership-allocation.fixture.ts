// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";


@json class TinyOwnership {
  n: i32 = 0;
}
const out = new TinyOwnership();
export function run(kind: i32): i32 {
  if (kind == 0) return JSON.parse<i32>("123");
  if (kind == 1) return <i32>JSON.parse<bool>("true");
  if (kind == 2) return JSON.parse<TinyOwnership>('{"n":7}', out).n;
  return JSON.parse<TinyOwnership>('{"n":7}').n;
}
