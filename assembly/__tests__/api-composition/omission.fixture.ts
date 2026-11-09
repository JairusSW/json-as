// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { Base, ExpressionBase } from "./omission-model.fixture";
function shouldOmit(_self: Base): bool {
  return false;
}
const OMIT: bool = false;


@json class Child extends Base {
  next: i32 = 9;
}


@json class ExpressionChild extends ExpressionBase {
  next: i32 = 9;
}
export function run(): string {
  return (
    JSON.stringify(new Child()) + "|" + JSON.stringify(new ExpressionChild())
  );
}
