// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { PublicLazy, calls, make } from "./lazy-barrel.fixture";


@json class Owner {
  value: PublicLazy = make();
}
export function run(): string {
  const out = JSON.parse<Owner>('{"value":{"value":7}}');
  const before = calls;
  const value = out.value.value;
  return before.toString() + ":" + calls.toString() + ":" + value.toString();
}
