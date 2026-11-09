// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { GrowingObject, makeObjectJson } from "./object-workload";

export function verify(target: i32): i32 {
  const input = makeObjectJson(target);
  const value = JSON.parse<GrowingObject>(input);
  if (JSON.stringify(value) != input) unreachable();
  return value.records.length;
}
