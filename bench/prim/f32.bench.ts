// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench.js";

// JS numbers are f64; we still emit the same 7-digit value for shape parity
// with the AS f32 bench.
const v1: number = 3.1415927;
const v2 = "3.1415927";

bench(
  "Serialize f32",
  () => {
    blackbox(JSON.stringify(v1));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-f32", "serialize");

bench(
  "Deserialize f32",
  () => {
    blackbox(JSON.parse(v2));
  },
  20_000_000,
  utf8ByteLength(v2),
);
dumpToFile("prim-f32", "deserialize");
