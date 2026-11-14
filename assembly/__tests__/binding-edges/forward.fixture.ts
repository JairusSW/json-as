// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { Forward } from "./forward-model.fixture";


@json class Token {
  value: i32 = 7;


  @serializer("number") encode(self: Forward<Token>): string {
    return self.value.toString();
  }


  @deserializer("number") decode(_s: string): Forward<Token> {
    return new Token();
  }
}
export function run(): string {
  return JSON.stringify(JSON.parse<Token>("7"));
}
