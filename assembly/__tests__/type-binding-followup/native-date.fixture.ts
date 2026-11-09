// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";
import { NativeDate, makeNative } from "./native-model";

@json
class Date {
  value: i32 = 3;
}

@json
class Both {
  native: NativeDate = makeNative();
  local: Date = new Date();
}

@json
class Nested {
  values: NativeDate[] = [];
  optional: NativeDate | null = null;
}

@json
class Implicit {
  native!: NativeDate;
  local: Date = new Date();
}
export function run(): string {
  const native = new Both();
  const source = '{"native":"1970-01-02T00:00:00.000Z","local":{"value":7}}';
  const fresh = JSON.parse<Both>(source);
  const reused = JSON.parse<Both>(source, new Both());
  assert(JSON.stringify(fresh) == source);
  assert(JSON.stringify(reused) == source);
  const implicit = JSON.parse<Implicit>(source);
  assert(implicit.native.getTime() == 86400000 && implicit.local.value == 7);
  const nested = JSON.parse<Nested>(
    '{"values":["1970-01-02T00:00:00.000Z"],"optional":null}',
  );
  assert(nested.values[0].getTime() == 86400000 && nested.optional === null);
  return (
    native.native.getTime().toString() +
    ":" +
    native.local.value.toString() +
    "|" +
    fresh.native.getTime().toString() +
    ":" +
    fresh.local.value.toString() +
    "|" +
    reused.native.getTime().toString() +
    ":" +
    reused.local.value.toString()
  );
}
