// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
type T = i32;
type Identity<U> = U;

@json class Holder<T> {
  value: Identity<T>;
  constructor(value: T) {
    this.value = value;
  }
}
export function run(): string {
  return JSON.stringify(new Holder<f32>(1.5));
}
