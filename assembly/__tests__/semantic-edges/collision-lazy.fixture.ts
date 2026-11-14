// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON as Json } from "json-as/assembly";
const JSON: i32 = 3;
type Num = i32;


@json class Concrete {
  value!: Json.Lazy<i32>;
  other: i32 = JSON;
}


@json class Generic<T> {
  value!: Json.Lazy<T>;
}


@json class Alias {
  value!: Json.Lazy<Num>;
}
namespace M {
  const JSON: i32 = 4;


  @json export class Owner {
    value!: Json.Lazy<i32>;
    other: i32 = JSON;
  }
}
export function run(): string {
  assert(new Concrete().value == 0);
  assert(new Generic<i32>().value == 0);
  assert(new Alias().value == 0);
  assert(new M.Owner().other == 4);
  const out = Json.parse<Concrete>('{"value":7}');
  assert(Json.parse<Generic<i32>>('{"value":7}').value == 7);
  assert(Json.parse<Alias>('{"value":7}').value == 7);
  assert(Json.parse<M.Owner>('{"value":7}').value == 7);
  return Json.stringify(out);
}
