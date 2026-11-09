// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
type Text = string;


@json class Token {
  value: i32 = 7;


  @deserializer("number") decode(source: Text): Token {
    return new Token();
  }
}
export function run(): string {
  return JSON.parse<Token>("7").value.toString();
}
