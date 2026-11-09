// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import { payloadBytes, STRUCT_STRINGIFY_OPS, structValueLazy } from "./shared";

bench(
  "Serialize Multilib Payload (json-as struct, lazy auto)",
  () => {
    blackbox(JSON.stringify(structValueLazy));
  },
  STRUCT_STRINGIFY_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-as-struct-lazy", "serialize");
