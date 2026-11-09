// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

export { PAYLOAD_SIZES, PAYLOAD_LABELS } from "./payload-sizes";

// ASCII with quotes and backslashes: all backends perform the same escaping.
export function makeString(targetBytes: number): string {
  const base =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890`~!@#$%^&*()-_=+[{]}\\|;:'\",<.>/?";
  let encodedBase = base.length;
  for (let i = 0; i < base.length; i++) {
    const code = base.charCodeAt(i);
    if (code === 34 || code === 92) encodedBase++;
  }
  const budget = targetBytes - 2;
  const repeats = Math.floor(budget / encodedBase);
  let remaining = budget - repeats * encodedBase;
  let prefix = "";
  for (let i = 0; i < base.length && remaining > 0; i++) {
    const code = base.charCodeAt(i);
    const cost = code === 34 || code === 92 ? 2 : 1;
    if (cost > remaining) break;
    prefix += base.charAt(i);
    remaining -= cost;
  }
  return repeatText(base, repeats) + prefix + repeatText("x", remaining);
}

// Shared JS/AssemblyScript setup code: no runtime-specific integer casts.
function repeatText(value: string, count: number): string {
  let out = "";
  while (count > 0) {
    if (count % 2 >= 1) out += value;
    count = Math.floor(count / 2);
    if (count > 0) value += value;
  }
  return out;
}
