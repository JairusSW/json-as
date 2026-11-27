// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../assembly";

let input = new Array<u32>();
let output = "";

export function setup(length: i32, value: u32): void {
  input = new Array<u32>(length);
  if (value) input.fill(value);
}

export function run(): string {
  output = JSON.stringify(input);
  return output;
}
