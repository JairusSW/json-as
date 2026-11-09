// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";

@json class Owner {
  raw!: JSON.Raw;
  values!: Map<string, i32>;
}
export function run(): string {
  return JSON.stringify(JSON.parse<Owner>('{"raw":7,"values":{"x":1}}'));
}
