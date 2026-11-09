// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { Middle } from "./ancestor-model.fixture";

@json class Leaf extends Middle {
  leaf: i32 = 4;
}
export function run(): string {
  assert(JSON.stringify(new Leaf()) == '{"wire":"seed","middle":3,"leaf":4}');
  const out = JSON.parse<Leaf>('{"wire":"updated","middle":8,"leaf":9}');
  assert(out.value == "updated");
  return JSON.stringify(out);
}
