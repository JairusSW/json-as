// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { dumpToFile } from "./lib/bench.js";
import { bench, blackbox, utf8ByteLength } from "./lib/bench.js";

const v1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const v2 = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"';

bench(
  "Serialize Alphabet",
  () => {
    blackbox(JSON.stringify(v1));
  },
  24_000_00,
  utf8ByteLength(v1),
);
dumpToFile("abc", "serialize");

bench(
  "Deserialize Alphabet",
  () => {
    blackbox(JSON.parse(v2));
  },
  24_000_00,
  utf8ByteLength(v2),
);
dumpToFile("abc", "deserialize");
