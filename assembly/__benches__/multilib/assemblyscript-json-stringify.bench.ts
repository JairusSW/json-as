// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { blackbox, bench, dumpToFile } from "../lib/bench";
import { ASJ_STRINGIFY_OPS, payloadBytes, asjValue } from "./shared";

bench(
  "Serialize Multilib Payload (assemblyscript-json)",
  () => {
    blackbox(asjValue.stringify());
  },
  ASJ_STRINGIFY_OPS,
  payloadBytes,
);
dumpToFile("multilib-assemblyscript-json", "serialize");
