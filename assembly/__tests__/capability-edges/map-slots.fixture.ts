// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
class Wide extends Map<string, u64> {}
class Narrow extends Map<string, i32> {}
class Shifted extends Map<string, u64> {
  values(): u64[] {
    return [1];
  }
}


@json class Custom extends Map<string, u64> {

  @serializer("object") encode(_self: Custom): string {
    return '{"replacement":5}';
  }
}
export function run(upcast: bool): string {
  const wide = new Wide();
  wide.set("n", 9007199254740993);
  const native = new Map<string, u64>();
  native.set("n", 9007199254740993);
  const control = JSON.Obj.from(native);
  control.set("tail", true);
  assert(JSON.stringify(control) == '{"n":9007199254740993,"tail":true}');
  assert(JSON.stringify(wide) == '{"n":9007199254740993}');
  assert(JSON.stringify(JSON.Obj.from(new Custom())) == '{"replacement":5}');
  const shifted = new Shifted();
  shifted.set("n", 9007199254740993);
  assert(JSON.Obj.from(shifted).getAs<u64>("n") == 9007199254740993);
  const object = upcast
    ? JSON.Obj.from<Map<string, u64>>(wide)
    : JSON.Obj.from(wide);
  object.set("tail", true);
  const narrow = new Narrow();
  narrow.set("a", 7);
  const small = upcast
    ? JSON.Obj.from<Map<string, i32>>(narrow)
    : JSON.Obj.from(narrow);
  const typed = small.getAs<i32>("a");
  small.set("tail", true);
  return (
    JSON.stringify(object) +
    "|" +
    typed.toString() +
    "|" +
    JSON.stringify(small)
  );
}
