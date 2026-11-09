// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
export function run(): string {
  const map = new Map<string | null, i32>();
  map.set(null, 7);
  return JSON.stringify(JSON.Obj.from(map));
}
