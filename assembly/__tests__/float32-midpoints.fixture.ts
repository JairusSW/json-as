// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";


@json class FloatValue {
  value: f32 = 0;
}
let reused = new FloatValue();
export const stringId = idof<string>();
export function root(input: string): u32 {
  return reinterpret<u32>(JSON.parse<f32>(input));
}
export function field(input: string, reuse: bool): u32 {
  return reinterpret<u32>(
    JSON.parse<FloatValue>(
      '{"value":' + input + "}",
      reuse ? reused : changetype<FloatValue>(0),
    ).value,
  );
}
export function array(input: string): u32 {
  return reinterpret<u32>(JSON.parse<f32[]>("[" + input + "]")[0]);
}
