// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import {
  PAYLOAD_SIZES,
  PAYLOAD_LABELS,
  makeString,
} from "../../../bench/throughput/string-workload";
import { bench, blackbox, dumpToFile } from "../lib/bench";

let value = "";
let input = "";
function operation(): void {
  blackbox(JSON.stringify(value));
}
for (let i = 0; i < PAYLOAD_SIZES.length; i++) {
  value = makeString(PAYLOAD_SIZES[i]);
  input = JSON.stringify(value);
  expect(JSON.parse<string>(input)).toBe(value);
  const bytes = String.UTF8.byteLength(input);
  const operations = min<i32>(200000, max<i32>(5, (500 * 1024 * 1024) / bytes));
  bench(
    "Serialize String (" + PAYLOAD_LABELS[i] + ")",
    operation,
    operations,
    bytes,
  );
  dumpToFile("str-" + PAYLOAD_LABELS[i], "serialize");
}
