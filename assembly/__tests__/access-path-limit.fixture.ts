// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";

@json
class GuardedRecord {
  id: i32 = 0;
  body: string = "";
}

export function guarded(mask: i32): i32 {
  const value = JSON.parse<GuardedRecord>('{"id":42,"body":"hello"}');
  if (mask & 1) { if (mask & 2) return 0; }
  if (mask & 4) { if (mask & 8) return 0; }
  if (mask & 16) { if (mask & 32) return 0; }
  if (mask & 64) { if (mask & 128) return 0; }
  if (mask & 256) { if (mask & 512) return 0; }
  if (mask & 1024) { if (mask & 2048) return 0; }
  if (mask & 4096) { if (mask & 8192) return 0; }
  if (mask & 16384) { if (mask & 32768) return 0; }
  if (mask & 65536) { if (mask & 131072) return 0; }
  if (mask & 262144) { if (mask & 524288) return 0; }
  if (mask & 1048576) { if (mask & 2097152) return 0; }
  if (mask & 4194304) { if (mask & 8388608) return 0; }
  if (mask & 16777216) { if (mask & 33554432) return 0; }
  return value.id;
}
