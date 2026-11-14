// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

@json class Token {
  value: i32 = 0;


  @serializer("number") encode(self: Token): string {
    return self.value.toString();
  }


  @deserializer("number") decode(data: string): Token {
    const out = new Token();
    out.value = <i32>parseInt(data);
    return out;
  }
}
type Identity<T> = T;
export type PublicToken = Identity<Token>;
export function make(): PublicToken {
  return new Token();
}
