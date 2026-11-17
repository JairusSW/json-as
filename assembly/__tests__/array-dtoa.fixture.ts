// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { umul64hiCarry } from "xjb-as/assembly/xjb";

export function selected(): i32 {
  return 0;
}
export function wrapperCalls(): i32 {
  return 0;
}
export function optimized(a: u64, carry: u64): u64 {
  return umul64hiCarry(a, 10, carry);
}
export function reference(a: u64, carry: u64): u64 {
  return umul64hiCarry(a, 10, carry);
}
export function scalar(bits: u64): string {
  return JSON.stringify(reinterpret<f64>(bits));
}
export function emit(count: i32, seed: u64, narrow: bool): string {
  let state = seed;
  if (narrow) {
    const values = new Array<f32>(count);
    for (let i = 0; i < count; i++) {
      state = state * 6364136223846793005 + 1442695040888963407;
      values[i] = reinterpret<f32>(<u32>(state >> 32));
    }
    return JSON.stringify(values);
  }
  const values = new Array<f64>(count);
  for (let i = 0; i < count; i++) {
    state = state * 6364136223846793005 + 1442695040888963407;
    values[i] = reinterpret<f64>(state);
  }
  return JSON.stringify(values);
}
export function edges(): string {
  return JSON.stringify<f64[]>([
    0.0,
    -0.0,
    reinterpret<f64>(1),
    -reinterpret<f64>(1),
    -1e-300,
    1e-6,
    1e-7,
    1e20,
    1e21,
    f64.MAX_VALUE,
    -f64.MAX_VALUE,
    9007199254740992.0,
    9007199254740994.0,
    NaN,
    Infinity,
    -Infinity,
  ]);
}
