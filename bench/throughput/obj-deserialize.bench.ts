// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bench, blackbox, dumpToFile } from "../lib/bench";
import { OBJECT_SIZES, OBJECT_LABELS, makeObjectJson } from "./object-workload";

let input = "";
let value: unknown;

function operation(): void {
  blackbox(JSON.parse(input));
}

for (let i = 0; i < OBJECT_SIZES.length; i++) {
  input = makeObjectJson(OBJECT_SIZES[i]);
  // Fixture is ASCII, so its code-unit and UTF-8 byte lengths agree.
  const bytes = input.length;
  const operations = Math.min(
    200000,
    Math.max(5, Math.floor((500 * 1024 * 1024) / bytes)),
  );
  const label = OBJECT_LABELS[i];
  value = JSON.parse(input);
  if (JSON.stringify(value) !== input)
    throw new Error("Growing-object fixture mismatch");
  bench("Deserialize Object (" + label + ")", operation, operations, bytes);
  dumpToFile("obj-" + label, "deserialize");
}
