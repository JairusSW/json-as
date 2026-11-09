// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile, utf8ByteLength } from "./lib/bench";


@json
class SmallJSON {
  id!: i32;
  name!: string;
  active!: boolean;
}
const v2 = `{"id":1,"name":"Small Object","active":true}`;
const v1 = JSON.parse<SmallJSON>(v2);
const byteLength: usize = utf8ByteLength(v2);
expect(JSON.stringify(JSON.parse<SmallJSON>(v2))).toBe(v2);
bench(
  "Serialize Small Object",
  () => {
    blackbox(JSON.stringify<SmallJSON>(v1));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small", "serialize");
bench(
  "Deserialize Small Object",
  () => {
    blackbox(JSON.parse<SmallJSON>(v2));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small", "deserialize");

// Dynamic JSON.Obj variant of the same payload (typed struct vs JSON.Obj).
const objSmall = JSON.parse<JSON.Obj>(v2);
bench(
  "Serialize Small (untouched JSON.Obj forwarding)",
  () => {
    blackbox(JSON.stringify(objSmall));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small-obj", "serialize");
bench(
  "Deserialize Small (JSON.Obj)",
  () => {
    blackbox(JSON.parse<JSON.Obj>(v2));
  },
  5_000_000,
  byteLength,
);
dumpToFile("small-obj", "deserialize");
