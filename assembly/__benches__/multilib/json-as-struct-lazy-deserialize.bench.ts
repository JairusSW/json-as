// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import {
  RepoLazy,
  payload,
  payloadBytes,
  STRUCT_DESERIALIZE_OPS,
} from "./shared";

bench(
  "Deserialize Multilib Payload (json-as struct, lazy auto)",
  () => {
    blackbox(JSON.parse<RepoLazy>(payload));
  },
  STRUCT_DESERIALIZE_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-as-struct-lazy", "deserialize");
