// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../assembly";

@json class Owner {
  values!: i64[];
  tail: i32 = 0;
}
@json class Token {
  value: i32 = 0;
  constructor(value: i32 = 0) { this.value = value; }
  @deserializer("number")
  decode(_source: string): Token {
    callbacks++;
    tokenOwner!.values = alternate;
    return new Token(7);
  }
}
@json class TokenOwner {
  values!: Token[];
  tail: i32 = 0;
}
class CallbackArray extends Array<i64> {
  constructor() { super(); super.push(9); }
  get length(): i32 {
    if (mutating) {
      mutating = false;
      getterCalls++;
      owner!.values = alternateNumbers;
    }
    return load<i32>(changetype<usize>(this), 12);
  }
  set length(value: i32) {
    assert(value == 0);
    store<i32>(changetype<usize>(this), value, 12);
  }
}
let mutating: bool = false;
let getterCalls: i32 = 0;
let alternateNumbers: i64[] = [];
let owner: Owner | null = null;
let tokenOwner: TokenOwner | null = null;
let alternate: Token[] = [];
let original: i64[] | null = null;
let fieldReads: i32 = 0;
let callbacks: i32 = 0;

// Called only by the test transform; never part of a timing module.
// Called by generated instrumentation rather than a source-level reference.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function readArrayField(parent: usize, offset: usize): usize {
  fieldReads++;
  return load<usize>(parent + offset);
}
// Called by generated instrumentation rather than a source-level reference.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function recordPublication(parent: usize, child: usize, multiple: bool = false): void {
  trace("[DEBUG-array-publication]", 2, parent, child);
  JSON.__linkObject(parent, child, multiple);
}
export function prepare(kind: i32): usize {
  callbacks = 0;
  getterCalls = 0;
  mutating = false;
  fieldReads = 0;
  if (kind == 2) {
    tokenOwner = new TokenOwner();
    alternate = [new Token(41)];
    return changetype<usize>(tokenOwner);
  }
  owner = new Owner();
  original = kind == 1 ? [99] : null;
  if (kind == 1) owner!.values = original!;
  if (kind == 4) {
    owner!.values = new CallbackArray();
    alternateNumbers = [41];
    mutating = true;
  }
  return changetype<usize>(owner);
}
export function fieldOffset(kind: i32): usize {
  return kind == 2 ? offsetof<TokenOwner>("values") : offsetof<Owner>("values");
}
export function exercise(kind: i32, spaced: bool): i32 {
  fieldReads = 0;
  if (kind == 2) {
    JSON.parse<TokenOwner>(spaced ? '{\n "values":[1],\n "tail":7\n}' : '{"values":[1],"tail":7}', tokenOwner!);
    assert(callbacks == 1 && tokenOwner!.tail == 7);
    assert(tokenOwner!.values.length == 1);
    assert(tokenOwner!.values[0].value == 7 || tokenOwner!.values[0].value == 41);
  } else {
    const data = kind == 3 ? '{\n "values":[1,2],\n "tail":7\n}' : '{\n "values":[],\n "tail":7\n}';
    JSON.parse<Owner>(spaced ? data : (kind == 3 ? '{"values":[1,2],"tail":7}' : '{"values":[],"tail":7}'), owner!);
    assert(owner!.tail == 7);
    if (kind == 3) assert(owner!.values.length == 2 && owner!.values[1] == 2);
    else if (kind == 4 && getterCalls) assert(owner!.values === alternateNumbers);
    else assert(owner!.values.length == 0);
  }
  return 1;
}
export function reads(): i32 { return fieldReads; }
export function mutations(): i32 { return getterCalls; }
