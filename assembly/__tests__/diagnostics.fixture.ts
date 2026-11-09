// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON as Json } from "../index";

const JSON: i32 = 3;
function unreachable(): void { abort("application shadow"); }

@json
class Row {
  value: i32 = 7;
}

@json
class UserCodec {
  @deserializer("number")
  decode(_input: string): UserCodec {
    throw new Error("user codec error");
  }
}

let array: Json.Arr | null = null;
export function setup(): void { array = new Json.Arr(); }
export function boundsFailure(): void { array!.at(0); }
export function parseFailure(): void { Json.parse<Row>('{"value":'); }
export function abortFailure(): void { Json.Value.from(new Map<i32, Json.Value>()); }
export function userFailure(): void { throw new Error("application error"); }
export function userAbort(): void { abort("application abort"); }
export function codecFailure(): void { Json.parse<UserCodec>("7"); }
export function valid(): i32 { return Json.parse<Row>('{"value":9}').value; }
export function numeric(): i32 { return Json.Value.from<f64>(1.5).get<i32>(); }
export function numericFailure(): i32 { return Json.Value.from<string>("7").get<i32>(); }

export function userUnreachable(): void { unreachable(); }
export function userConstant(): i32 { return JSON; }
