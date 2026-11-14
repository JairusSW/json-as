// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";


@json
class Labels {

  @alias("hello\ud83d\ude00")
  value: i32 = 7;


  @alias("abcd\uffff")
  text: string = "\ud83d\ude00content";


  @alias("abcd\u8000")
  other: string = "literal\u8000\uffff";
}

export function run(kind: i32): string {
  const source = JSON.stringify(new Labels());
  if (kind == 0) return source;
  if (kind == 1) return JSON.stringify(JSON.parse<Labels>(source));
  return JSON.stringify(JSON.parse<Labels>(source, new Labels()));
}
