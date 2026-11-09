// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import { Repo, payload, payloadBytes, STRUCT_DESERIALIZE_OPS } from "./shared";

// Allocate the target graph once, then reuse it on every iteration via
// parseInto. After the first parse the fast path reuses every field, so this
// loop should allocate ~nothing - isolating allocator cost from parse cost.
const target = JSON.parse<Repo>(payload);

bench(
  "Deserialize Multilib Payload (json-as struct, reuse)",
  () => {
    blackbox(JSON.parse<Repo>(payload, target));
  },
  STRUCT_DESERIALIZE_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-as-struct-reuse", "deserialize");
