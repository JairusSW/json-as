// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
let values = new JSON.Arr();
let output = "";
export function setup(length: i32): void {
  values = new JSON.Arr();
  for (let i = 0; i < length; i++) values.push<string>("value-" + i.toString());
}
export function run(): string {
  output = values.join("|");
  return output;
}
