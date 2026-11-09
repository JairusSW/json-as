// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";


@json
class State {

  @alias("return srcStart;")
  value: i32 = 7;

  @alias("return srcStart + 2;")
  other: i32 = 8;

  @alias("return srcStartX;")
  control: i32 = 0;
}

export function run(pretty: bool): string {
  const source = pretty
    ? '{ "return srcStart;": 9, "return srcStart + 2;": 10, "return srcStartX;": 11 }'
    : '{"return srcStart;":9,"return srcStart + 2;":10,"return srcStartX;":11}';
  const out = JSON.parse<State>(source);
  JSON.parse<State>(source, out);
  return (
    out.value.toString() +
    ":" +
    out.other.toString() +
    ":" +
    out.control.toString()
  );
}
