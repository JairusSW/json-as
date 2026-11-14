// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";


@json
class OutputControl {
  n: i32 = 7;
}

function copyText(value: string): string {
  const size = (<usize>value.length) << 1;
  const copy = changetype<string>(__new(size, idof<string>()));
  memory.copy(changetype<usize>(copy), changetype<usize>(value), size);
  return copy;
}

// Each host invocation runs in a new instance: a failing static write must not
// contaminate another case or the interned strings used by its expectations.
export function run(kind: i32): i32 {
  const wide =
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  const target =
    kind == 0 || kind == 1 || kind == 5 || kind == 10 || kind == 11
      ? JSON.stringify<bool>(false)
      : wide;
  const original = copyText(target);
  let expected = "";
  let result = "";
  if (kind == 0) {
    expected = copyText(JSON.stringify<bool>(true));
    result = JSON.stringify<bool>(true, target);
  } else if (kind == 1) {
    expected = copyText(JSON.stringify<string | null>(null));
    result = JSON.stringify<string | null>(null, target);
  } else if (kind == 2) {
    expected = copyText(JSON.stringify<i32>(7));
    result = JSON.stringify<i32>(7, target);
  } else if (kind == 3) {
    expected = copyText(JSON.stringify<f64>(1.5));
    result = JSON.stringify<f64>(1.5, target);
  } else if (kind == 4) {
    const date = new Date(86400000);
    expected = copyText(JSON.stringify<Date>(date));
    result = JSON.stringify<Date>(date, target);
  } else if (kind == 5) {
    expected = copyText(JSON.stringify<bool>(true));
    result = JSON.internal.stringify<bool>(true, target);
  } else if (kind == 6) {
    expected = copyText(JSON.stringify<i32>(7));
    result = JSON.internal.stringify<i32>(7, target);
  } else if (kind == 7) {
    const date = new Date(86400000);
    expected = copyText(JSON.stringify<Date>(date));
    result = JSON.internal.stringify<Date>(date, target);
  } else if (kind == 8) {
    expected = copyText(JSON.stringify<string>("hello"));
    result = JSON.internal.stringify<string>("hello", target);
  } else if (kind == 9) {
    const row = new OutputControl();
    expected = copyText(JSON.stringify(row));
    result = JSON.stringify(row, target);
  } else if (kind == 10) {
    expected = copyText(JSON.stringify<string>("x"));
    result = JSON.stringify<string>("x", target);
  } else if (kind == 11) {
    expected = copyText(JSON.stringify<f64>(NaN));
    result = JSON.stringify<f64>(NaN, target);
  } else {
    const row = new OutputControl();
    expected = copyText(JSON.stringify(row));
    result = JSON.internal.stringify(row, target);
  }
  let errors = 0;
  if (result != expected) errors |= 1;
  if (target != original) errors |= 2;
  return errors;
}
