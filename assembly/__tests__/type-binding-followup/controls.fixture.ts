// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";


@json
class Decorated<T> {

  @omitif((self: Decorated<T>) => isInteger<T>()) value!: T;
}


@json
class Numbers extends Decorated<i32> {
  tag: string = "numbers";
}


@json
class Texts extends Decorated<string> {
  tag: string = "texts";
}
class StringForm<T> {

  @omitif("isInteger<T>()") value!: T;
}


@json
class StringNumbers extends StringForm<i32> {
  tag: string = "numbers";
}


@json
class StringTexts extends StringForm<string> {
  tag: string = "texts";
}
export function run(): string {
  const n = new Numbers();
  n.value = 7;
  const s = new Texts();
  s.value = "ok";
  const sn = new StringNumbers();
  sn.value = 7;
  const ss = new StringTexts();
  ss.value = "ok";
  return (
    JSON.stringify(n) +
    "|" +
    JSON.stringify(s) +
    "|" +
    JSON.stringify(sn) +
    "|" +
    JSON.stringify(ss)
  );
}
