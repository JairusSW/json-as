// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

/* eslint-disable @typescript-eslint/no-wrapper-object-types -- AssemblyScript String is the native string type tested here. */
import { JSON } from "../..";
type Text = String;

@json class Token {
  value: i32 = 7;

  @serializer("number") encode(self: Token): String {
    return self.value.toString();
  }

  @deserializer("number") decode(data: String): Token {
    const out = new Token();
    out.value = <i32>parseInt(data);
    return out;
  }
}

@json class AliasToken {
  value: i32 = 7;

  @serializer("number") encode(self: AliasToken): Text {
    return self.value.toString();
  }
}
export function run(): string {
  return (
    JSON.stringify(new Token()) +
    ":" +
    JSON.stringify(JSON.parse<Token>("7")) +
    ":" +
    JSON.stringify(new AliasToken())
  );
}
