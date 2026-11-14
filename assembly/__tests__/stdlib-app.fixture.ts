// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { OrdinarySession } from "./stdlib-app/session";
import { SecuritySession } from "./stdlib-app/security";
import { MemorySession } from "./stdlib-app/memory";
import { UtilitySession } from "./stdlib-app/util/session";

function check<T>(): void {
  const value = JSON.parse<T>('{"id":7}');
  if (JSON.stringify<T>(value) != '{"id":7}')
    throw new Error("application model skipped");
}
export function verify(): i32 {
  check<OrdinarySession>();
  check<SecuritySession>();
  check<MemorySession>();
  check<UtilitySession>();
  return 1;
}
