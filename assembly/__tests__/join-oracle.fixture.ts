// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
export function allocInput(bytes: i32): usize {
  return __new(bytes, idof<string>());
}
export function run(source: string, separator: string, eager: bool): string {
  const value = JSON.parse<JSON.Arr>(source);
  if (eager) for (let i = 0; i < value.length; i++) value.at(i);
  // Minimal GC scans pinned/global roots rather than managed stack locals.
  __pin(changetype<usize>(value));
  __collect();
  const result = value.join(separator);
  __unpin(changetype<usize>(value));
  return result;
}
