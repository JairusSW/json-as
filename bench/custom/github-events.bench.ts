// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { readFile } from "../lib/bench";
import { bench, blackbox, dumpToFile } from "../lib/bench";
// import { readFile } from "../lib/bench";

const objStr = readFile("./assembly/__benches__/payloads/github-events.json");
// console.log("obj: " + objStr.slice(0, 100));

const parsed = JSON.parse(objStr);
bench(
  "Deserialize Github Events",
  () => {
    blackbox(JSON.parse(objStr));
  },
  100,
  utf8ByteLength(objStr),
);
dumpToFile("github-events", "deserialize");

bench(
  "Serialize Github Events",
  () => {
    blackbox(JSON.stringify(parsed));
  },
  100,
  utf8ByteLength(objStr),
);
dumpToFile("github-events", "deserialize");
