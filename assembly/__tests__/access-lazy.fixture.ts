// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";

@json({ lazy })
class Record {
  @optional id: i32 = 7;
  @optional body: string = "default";
}

@json({ nolazy })
class Eager {
  id: i32 = 0;
  body: string = "";
}

@json({ lazy: false })
class Disabled {
  id: i32 = 0;
  body: string = "";
}

@json({ lazy: true })
class Enabled {
  id: i32 = 0;
  body: string = "";
}

@json
class Child extends Eager {
  tail: i32 = 0;
}

const input = '{"id":42,"body":"hello"}';

export function partial(): i32 {
  const value = JSON.parse<Enabled>(input);
  return value.id;
}

export function full(): string {
  const value = JSON.parse<Record>(input);
  return value.id.toString() + ":" + value.body;
}

export function serialized(): string {
  const value = JSON.parse<Enabled>(input);
  const id = value.id;
  return id.toString() + "|" + JSON.stringify(value);
}

export function eager(): i32 {
  return JSON.parse<Eager>(input).id + JSON.parse<Disabled>(input).id;
}

export function inherited(): string {
  const value = JSON.parse<Child>('{"id":42,"body":"hello","tail":3}');
  return JSON.stringify(value);
}

function escape(): Record {
  return JSON.parse<Record>(input);
}

export function escaped(): string {
  return escape().body;
}

export function reuse(): string {
  const out = JSON.parse<Record>(input);
  const value = JSON.parse<Record>('{"body":"new"}', out);
  return value.id.toString() + ":" + value.body;
}

export function noDeferredSlots(): bool {
  return !isDefined(changetype<Record>(0).__SET_SRC) &&
    !isDefined(changetype<Enabled>(0).__SET_SRC);
}

export function dynamic(): string {
  const value = JSON.parse<JSON.Arr>('[{"n":1},null]');
  value.getAs<JSON.Obj>(0).set<i32>("n", 2);
  return JSON.stringify(value);
}

// These internal namespace calls must remain usable after removing `export`,
// including in optimized builds where unreachable helpers are eliminated.
export function internalHelper(): bool {
  const text = "42";
  const ptr = changetype<usize>(text);
  return JSON.__cursorSkipGeneric<i32>(ptr, ptr + 4) == ptr + 4 &&
    JSON.__cursorSkipNative(ptr, ptr + 4, 2) == ptr + 4;
}
