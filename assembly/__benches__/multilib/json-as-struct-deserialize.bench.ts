// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { blackbox, bench, dumpToFile } from "../lib/bench";
import {
  Repo,
  payload,
  payloadBytes,
  payloadEnd,
  payloadStart,
  STRUCT_DESERIALIZE_OPS,
  structValue,
} from "./shared";

bench(
  "Deserialize Multilib Payload (json-as struct)",
  () => {
    blackbox(JSON.parse<Repo>(payload));
    // blackbox(
    //   JSON.__deserialize<Repo>(
    //     payloadStart,
    //     payloadEnd,
    //     changetype<usize>(structValue),
    //   ),
    // );
  },
  STRUCT_DESERIALIZE_OPS,
  payloadBytes,
);
dumpToFile("multilib-json-as-struct", "deserialize");
