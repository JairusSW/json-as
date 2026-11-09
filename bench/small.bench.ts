// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bench, blackbox, dumpToFile, utf8ByteLength } from "./lib/bench.js";

class SmallJSON {
  public id!: number;
  public name!: string;
  public active!: boolean;
}

const v2 = '{"id":1,"name":"Small Object","active":true}';
const v1 = JSON.parse(v2) as SmallJSON;

bench(
  "Serialize Small Object",
  () => {
    blackbox(JSON.stringify(v1));
  },
  5_000_000,
  utf8ByteLength(v2),
);
dumpToFile("small", "serialize");

bench(
  "Deserialize Small Object",
  () => {
    blackbox(JSON.parse(v2));
  },
  5_000_000,
  utf8ByteLength(v2),
);
dumpToFile("small", "deserialize");
