// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
type Identity<T> = T;
namespace M {
  type Item = f32;


  @json export class Row {
    value: Identity<Item> = 1.5;
  }
}
export function run(): string {
  return JSON.stringify(JSON.parse<M.Row>('{"value":2.5}'));
}
