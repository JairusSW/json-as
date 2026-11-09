// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile, utf8ByteLength } from "./lib/bench";


@json
class Token {
  uid!: u32;
  token!: string;
}
const v2 = `{"uid":256,"token":"dewf32df@#G43g3Gs!@3sdfDS#2"}`;
const v1 = JSON.parse<Token>(v2);
expect(JSON.stringify(JSON.parse<Token>(v2))).toBe(v2);
bench(
  "Serialize Token Object",
  () => {
    blackbox<string>(JSON.stringify(v1));
  },
  5_000_000,
  utf8ByteLength(v2),
);
dumpToFile("token", "serialize");
bench(
  "Deserialize Token Object",
  () => {
    blackbox<Token>(JSON.parse<Token>(v2));
  },
  5_000_000,
  utf8ByteLength(v2),
);
dumpToFile("token", "deserialize");

// Dynamic JSON.Obj variant of the same payload (typed struct vs JSON.Obj).
const objToken = JSON.parse<JSON.Obj>(v2);
bench(
  "Serialize Token (untouched JSON.Obj forwarding)",
  () => {
    blackbox(JSON.stringify(objToken));
  },
  5_000_000,
  utf8ByteLength(v2),
);
dumpToFile("token-obj", "serialize");
bench(
  "Deserialize Token (JSON.Obj)",
  () => {
    blackbox(JSON.parse<JSON.Obj>(v2));
  },
  5_000_000,
  utf8ByteLength(v2),
);
dumpToFile("token-obj", "deserialize");
