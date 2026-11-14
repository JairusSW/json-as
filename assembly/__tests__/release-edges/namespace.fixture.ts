// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { Models } from "./barrel.fixture";


@json class Child extends Models.Base {
  tail: i32 = 9;
}


@json class EnumOwner {
  value: Models.State = Models.State.Off;
}


@json class LazyOwner {
  value: Models.Deferred = Models.make();
}
export function run(): string {
  const child = JSON.parse<Child>('{"value":5,"tail":9}');
  const en = JSON.parse<EnumOwner>('{"value":1}');
  const lazy = JSON.parse<LazyOwner>('{"value":7}');
  const before = Models.count();
  const token = lazy.value;
  return (
    JSON.stringify(child) +
    ":" +
    en.value.toString() +
    ":" +
    before.toString() +
    ":" +
    Models.count().toString()
  );
}
