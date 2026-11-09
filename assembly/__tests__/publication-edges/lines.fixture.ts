// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";

@json class Record {
  value: string = "left\u2028right";
  other: string = "left\u2029right";
}
export function run(): string {
  const native = new Record();
  const parsed = JSON.parse<Record>("{}");
  assert(parsed.value === native.value);
  assert(parsed.other === native.other);
  return parsed.value.length.toString() + "|" + parsed.other.length.toString();
}
