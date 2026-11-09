// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSONMode, toRaw, fromRaw, toBox } from "../../../index";
export function run(): string {
  return (
    fromRaw(toRaw('{"x":1}')) +
    "|" +
    toBox<i32>(7).value.toString() +
    "|" +
    JSONMode.SWAR.toString()
  );
}
