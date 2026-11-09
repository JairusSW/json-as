// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
type Inner = JSON.Lazy<i32>;
type Identity<T> = T;
namespace Model {
  type Inner = JSON.Lazy<f32>;

  @json export class Row {
    value: Identity<Inner> = 0;
  }
}
function kind<T>(value: T): string {
  return isFloat<T>() ? "float" : "integer";
}
export function run(): string {
  const type = kind(new Model.Row().value);
  return type + ":" + JSON.parse<Model.Row>('{"value":1.5}').value.toString();
}
