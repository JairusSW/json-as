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
  title: string = "default";
  body: string = "default body";
}

const input = '{"id":7,"title":"hello","body":"some text"}';

export function partial(): i32 {
  const value = JSON.parse<Record>(input);
  return value.id;
}

function identity(value: Record): Record { return value; }
export function eagerPartial(): i32 {
  const value = identity(JSON.parse<Record>(input));
  return value.id;
}

export function full(): string {
  const value = JSON.parse<Record>(input);
  return value.id.toString() + ":" + value.title + ":" + value.body;
}

function escape(): Record {
  return JSON.parse<Record>(input);
}

export function escaped(): string {
  return escape().body;
}

export function serialized(): string {
  const value = JSON.parse<Record>(input);
  return JSON.stringify(value);
}

export function reordered(): i32 {
  const value = JSON.parse<Record>(' { "body" : "abc", "id" : 8, "title" : "x" } ');
  return value.id;
}

let saved: Record | null = null;
export function stored(): string {
  const value = JSON.parse<Record>(input);
  saved = value;
  return saved!.body;
}

export function throughUnchecked(): string {
  const value = JSON.parse<Record>(input);
  const alias = unchecked(value);
  return alias.body;
}

export function reused(): string {
  const value = JSON.parse<Record>(input);
  const result = JSON.parse<Record>('{"id":8,"title":"new","body":"changed"}', value);
  return result.id.toString() + ":" + result.body;
}

export function escapedString(): i32 {
  const value = JSON.parse<Record>('{"id":9,"title":"a\\\\b","body":"\\u00e9"}');
  return value.id;
}

@json
class NullableRecord {
  id: i32 = 0;
  description: string | null = null;
}

export function nullableString(): i32 {
  const value = JSON.parse<NullableRecord>('{"id":10,"description":"text"}');
  return value.id;
}

export function nullableNull(): i32 {
  const value = JSON.parse<NullableRecord>('{"id":11,"description":null}');
  return value.id;
}

@json
class Aliased {
  id: i32 = 0;
  @alias("display-name") name: string = "default";
}

export function aliased(): i32 {
  const value = JSON.parse<Aliased>('{"id":12,"display-name":"changed"}');
  return value.id;
}

class Parent {
  inherited: string = "base";
}

@json
class Child extends Parent {
  id: i32 = 0;
  other: string = "child";
}

export function inheritedPartial(): i32 {
  const value = JSON.parse<Child>('{"inherited":"parent","id":14,"other":"text"}');
  return value.id;
}

export function inheritedFull(): string {
  const value = JSON.parse<Child>('{"inherited":"parent","id":14,"other":"text"}');
  return value.inherited + ":" + value.other;
}

@json
class DecoratedParent {
  inherited: string = "base";
}

@json
class DecoratedChild extends DecoratedParent {
  id: i32 = 0;
}

export function decoratedInheritedPartial(): i32 {
  const value = JSON.parse<DecoratedChild>('{"inherited":"parent","id":15}');
  return value.id;
}

class GenericParent<T> {
  value!: T;
  inherited: string = "base";
}

@json
class GenericChild extends GenericParent<i32> {
  tail: i32 = 0;
}

export function genericInherited(): string {
  const value = JSON.parse<GenericChild>('{"value":16,"inherited":"parent","tail":2}');
  return value.value.toString() + ":" + value.inherited;
}

@json
class Scalars {
  id: i32 = 0;
  signed: i64 = 1;
  unsigned: u64 = 2;
  fraction: f64 = 3.0;
  flag: bool = false;
}

export function scalarPartial(): i32 {
  const value = JSON.parse<Scalars>('{"id":17,"signed":-9223372036854775808,"unsigned":18446744073709551615,"fraction":-1.25e3,"flag":true}');
  return value.id;
}

export function scalarFull(): string {
  const value = JSON.parse<Scalars>('{"id":17,"signed":-9,"unsigned":42,"fraction":1.25,"flag":true}');
  return value.id.toString() + ":" + value.signed.toString() + ":" + value.unsigned.toString() + ":" + value.fraction.toString() + ":" + value.flag.toString();
}

namespace Namespaced {
  @json
  export class Data {
    id: i32 = 0;
    unused: string = "";
  }
}

export function namespaced(): i32 {
  const value = JSON.parse<Namespaced.Data>('{"id":18,"unused":"text"}');
  return value.id;
}

let codecCalls = 0;
@json
class Codec {
  value: i32 = 0;
  @deserializer("number") decode(data: string): Codec {
    codecCalls++;
    const value = new Codec();
    value.value = <i32>parseInt(data);
    return value;
  }
}

@json
class WithCodec {
  id: i32 = 0;
  ignored: string = "default";
  value!: Codec;
}

export function codecEffects(): i32 {
  codecCalls = 0;
  const value = JSON.parse<WithCodec>('{"id":13,"ignored":"text","value":7}');
  return value.id + codecCalls * 100;
}

let calls = 0;
function next(): i32 { return ++calls; }

@json
class Effectful {
  id: i32 = next();
  ignored: string = "default";
}

export function initializerEffects(): i32 {
  calls = 0;
  const value = JSON.parse<Effectful>('{"ignored":"text"}');
  return calls * 10 + value.id;
}
