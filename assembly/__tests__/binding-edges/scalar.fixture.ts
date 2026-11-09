// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { Plain, Decorated } from "./scalar-model.fixture";
type Scalar = i32;

@json class A extends Plain {
  tail: i32 = 9;
}

@json class B extends Decorated {
  tail: i32 = 9;
}
export function run(): string {
  assert(new A().value == 1.5);
  assert(new B().value == 1.5);
  return JSON.stringify(new A()) + ":" + JSON.stringify(new B());
}
