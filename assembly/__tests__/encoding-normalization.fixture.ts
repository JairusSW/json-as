// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { normalizeJSONEncoding } from "../util/validateJson";

export function normalize(input: string): string {
  return normalizeJSONEncoding(input);
}
export function validate(input: string): bool {
  return JSON.validate(input);
}
export function parse(input: string): string {
  return JSON.parse<string>(input);
}
export function stringId(): u32 {
  return idof<string>();
}
