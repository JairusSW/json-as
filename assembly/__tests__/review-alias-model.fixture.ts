// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";

@json class Hidden {
  value: i32 = 7;
}
export type PublicLazy = JSON.Lazy<Hidden>;
export function make(): PublicLazy {
  return new Hidden();
}

@json class HiddenGeneric<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}
export type PublicAlias = HiddenGeneric<i32>;
export function makeGeneric(): PublicAlias {
  return new HiddenGeneric<i32>(9);
}
