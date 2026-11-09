// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bench } from "../__benches__/lib/bench";
let calls: i32 = 0;
function routine(): void {
  calls++;
  if (calls > 40) throw new Error("warmup made no progress");
}
export function run(ops: u64): i32 {
  calls = 0;
  bench("boundary", routine, ops);
  return calls;
}
