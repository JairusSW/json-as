// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";


@json
class IntegerRecord {
  s: i64 = 0;
  u: u64 = 0;
  values: i64[] = [];
}

export function signed(value: i64): string {
  return JSON.stringify<i64>(value);
}

export function unsigned(value: u64): string {
  return JSON.stringify<u64>(value);
}

export function compound(value: u64): string {
  const out = new IntegerRecord();
  out.s = <i64>value;
  out.u = value;
  out.values = [<i64>value, <i64>~value];
  return JSON.stringify(out);
}
