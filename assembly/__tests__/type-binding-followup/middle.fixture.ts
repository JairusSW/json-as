// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";
import { Middle } from "./omission-base";


@json
class Numbers extends Middle<i32> {
  tag: string = "numbers";
}


@json
class Texts extends Middle<string> {
  tag: string = "texts";
}
export function run(): string {
  const n = new Numbers();
  n.value = 7;
  const s = new Texts();
  s.value = "ok";
  return JSON.stringify(n) + "|" + JSON.stringify(s);
}
