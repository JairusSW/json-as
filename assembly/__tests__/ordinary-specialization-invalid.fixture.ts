// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";

@json
class Record {
  id: i32 = 0;
  ignored: string = "";
}

export function read(input: string): i32 {
  const value = JSON.parse<Record>(input);
  return value.id;
}

export function makeInput(which: i32): string {
  if (which == 0) return '{"id":7,"ignored":"valid\\ntext"}';
  if (which == 1) return '{"id":7,"ignored":"invalid\\q"}';
  if (which == 2) return '{"id":7,"ignored":{}}';
  if (which == 3) return '{"id":7,"ignored":"unfinished}';
  if (which == 4) return '{"id":7,"ignored":"\\u123x"}';
  if (which == 5) return '{"ignored":"valid","id":7}';
  if (which == 6) return '{"id":7,"ignored":"\x01"}';
  return '{"id":7,"ignored":"\u0122"}';
}

@json
class Nullable {
  id: i32 = 0;
  ignored: string | null = null;
}

export function readNullable(input: string): i32 {
  const value = JSON.parse<Nullable>(input);
  return value.id;
}

@json
class Numeric {
  id: i32 = 0;
  signed: i32 = 0;
  unsigned: u32 = 0;
  decimal: f64 = 0;
  flag: bool = false;
}

export function readNumeric(input: string): i32 {
  const value = JSON.parse<Numeric>(input);
  return value.id;
}

export function makeNumericInput(which: i32): string {
  if (which == 0) return '{"id":7,"signed":-2,"unsigned":3,"decimal":1.5e2,"flag":true}';
  if (which == 1) return '{"id":7,"signed":1.5,"unsigned":3,"decimal":1.5,"flag":true}';
  if (which == 2) return '{"id":7,"signed":1,"unsigned":-2,"decimal":1.5,"flag":true}';
  if (which == 3) return '{"id":7,"signed":1e2,"unsigned":3,"decimal":1.5,"flag":true}';
  if (which == 4) return '{"id":7,"signed":1,"unsigned":3,"decimal":{},"flag":true}';
  if (which == 5) return '{"id":7,"signed":1,"unsigned":3,"decimal":1.5,"flag":null}';
  if (which == 6) return '{"id":7,"signed":01,"unsigned":3,"decimal":1.5,"flag":true}';
  if (which == 7) return '{"id":7,"signed":1,"unsigned":3,"decimal":1e,"flag":true}';
  return '{"id":7,"signed":1,"unsigned":-0,"decimal":1.5,"flag":true}';
}

@json
class Nested {
  count: i32 = 0;
  label: string | null = null;
  values: Array<i32> = [];
}

@json
class Parent {
  id: i32 = 0;
  child!: Nested;
}

export function readNested(input: string): i32 {
  const value = JSON.parse<Parent>(input);
  return value.id;
}

export function makeNestedInput(which: i32): string {
  if (which == 0) return '{"id":7,"child":{"count":1,"label":"ok","values":[1,2]}}';
  if (which == 1) return '{"id":7,"child":{"count":"wrong","label":"ok","values":[1]}}';
  if (which == 2) return '{"id":7,"child":{"count":1,"label":"ok","values":[1,"wrong"]}}';
  if (which == 3) return '{"id":7,"child":{"count":1,"label":"bad\\q","values":[]}}';
  if (which == 4) return '{"id":7,"child":{"label":null,"values":[],"count":1}}';
  if (which == 5) return '{"id":7,"child":{"count":1,"label":null,"values":[],"extra":2}}';
  if (which == 6) return '{"id":7,"child":{"count":1,"label":null,"values":[1,]}}';
  return '{"id":7,"child":{"count":1,"label":"\x01","values":[]}}';
}

@json
class Generic<T> {
  id: i32 = 0;
  value!: T;
}

export function readGeneric(input: string): i32 {
  const value = JSON.parse<Generic<f32>>(input);
  return value.id;
}

export function makeGenericInput(which: i32): string {
  if (which == 0) return '{"id":7,"value":1.5}';
  if (which == 1) return '{"id":7,"value":"wrong"}';
  if (which == 2) return '{"id":7,"value":1e}';
  if (which == 3) return '{"id":7,"value":{}}';
  return '{"id":7,"value":null}';
}

export function readGenericArray(input: string): i32 {
  const value = JSON.parse<Generic<Array<i32>>>(input);
  return value.id;
}

export function makeGenericArrayInput(which: i32): string {
  return which == 0 ? '{"id":7,"value":[1,2]}' : '{"id":7,"value":[1,"wrong"]}';
}

type ReviewAmount = f32;
type ReviewCount = i32;
type ReviewFlag = boolean;
namespace FloatAliasScope {
  type f32 = i32;
  @json class AliasRecord { id: i32 = 0; value: ReviewAmount = 0; }
  export function read(input: string): i32 { return JSON.parse<AliasRecord>(input).id; }
}
namespace IntegerAliasScope {
  type i32 = u32;
  @json class AliasRecord { id: u32 = 0; value: ReviewCount = 0; }
  export function read(input: string): u32 { return JSON.parse<AliasRecord>(input).id; }
}
namespace BooleanAliasScope {
  type boolean = i32;
  @json class AliasRecord { id: i32 = 0; value: ReviewFlag = false; }
  export function read(input: string): i32 { return JSON.parse<AliasRecord>(input).id; }
}
export function readAliasFloat(input: string): i32 { return FloatAliasScope.read(input); }
export function readAliasInteger(input: string): u32 { return IntegerAliasScope.read(input); }
export function readAliasBoolean(input: string): i32 { return BooleanAliasScope.read(input); }
export function makeAliasInput(which: i32): string {
  if (which == 0 || which == 3 || which == 6) return '{"id":7,"value":"wrong"}';
  if (which == 1) return '{"id":7,"value":1.5}';
  if (which == 2) return '{"id":7,"value":"42"}';
  if (which == 4) return '{"id":7,"value":42}';
  if (which == 5) return '{"id":7,"value":"true"}';
  return '{"id":7,"value":true}';
}
