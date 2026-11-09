// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { PAYLOAD_SIZES, PAYLOAD_LABELS, makeString } from "./string-workload";
import { bench, blackbox, dumpToFile } from "../lib/bench";

let value = "";
let input = "";
function operation(): void {
  blackbox(JSON.parse(input));
}
for (let i = 0; i < PAYLOAD_SIZES.length; i++) {
  value = makeString(PAYLOAD_SIZES[i]);
  input = JSON.stringify(value);
  if (JSON.parse(input) !== value) throw Error("String fixture mismatch");
  const bytes = input.length;
  const operations = Math.min(
    200000,
    Math.max(5, Math.floor((500 * 1024 * 1024) / bytes)),
  );
  bench(
    "Deserialize String (" + PAYLOAD_LABELS[i] + ")",
    operation,
    operations,
    bytes,
  );
  dumpToFile("str-" + PAYLOAD_LABELS[i], "deserialize");
}
