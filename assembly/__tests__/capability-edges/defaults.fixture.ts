// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";


@json class Child<T> {

  @optional value: T = <T>7;


  @optional other: i32 = 8;
}


@json class Parent {
  child: Child<i32> | null = null;
}


@json class Initialized {
  child: Child<i32> = new Child<i32>();
}
function show(p: Parent): string {
  if (p.child === null) return "null";
  return p.child!.value.toString() + ":" + p.child!.other.toString();
}
export function run(pretty: bool): string {
  assert(new Child<i32>().value == 7);
  assert(new Child<i32>().other == 8);
  const root = JSON.parse<Child<i32>>("{}");
  assert(root.value == 7 && root.other == 8);
  const initialized = JSON.parse<Initialized>('{"child":{}}');
  assert(initialized.child.value == 7 && initialized.child.other == 8);
  const source = pretty ? '{ "child": { } }' : '{"child":{}}';
  return (
    show(JSON.parse<Parent>(source)) +
    "|" +
    show(JSON.parse<Parent>(source, new Parent()))
  );
}
