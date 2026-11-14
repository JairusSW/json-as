// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
export namespace M {

  @json export class Base {
    value: i32 = 7;
  }
  export enum State {
    Off,
    On,
  }
  let calls: i32 = 0;


  @json class Token {
    value: i32 = 0;


    @deserializer("number") decode(_s: string): Token {
      calls++;
      return new Token();
    }
  }
  export type Deferred = JSON.Lazy<Token>;
  export function make(): Deferred {
    return new Token();
  }
  export function count(): i32 {
    return calls;
  }
}
