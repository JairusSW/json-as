// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
namespace Model {

  @json export class Token {
    value: i32 = 7;


    @serializer("number") encode(self: Model.Token): string {
      return self.value.toString();
    }
  }
}
export function run(): string {
  return JSON.stringify(new Model.Token());
}
