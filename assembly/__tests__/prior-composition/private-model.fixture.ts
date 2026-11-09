// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";

@json class Hidden {
  value: i32 = 7;
}
enum State {
  Off,
  On,
}
export type PublicArray = Array<Hidden>;
export type PublicState = State;
export type PublicMaybeLazy = JSON.Lazy<Hidden | null>;
export function make(): PublicArray {
  return [new Hidden()];
}

@json export class Base {
  value: Hidden = new Hidden();
}
