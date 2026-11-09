// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bench, blackbox, dumpToFile, utf8ByteLength } from "./lib/bench.js";

class Token {
  public uid!: number;
  public token!: string;
}

const v2 = '{"uid":256,"token":"dewf32df@#G43g3Gs!@3sdfDS#2"}';
const v1 = JSON.parse(v2) as Token;

bench(
  "Serialize Token",
  () => {
    blackbox(JSON.stringify(v1));
  },
  5_000_000,
  utf8ByteLength(v2),
);
dumpToFile("token", "serialize");

bench(
  "Deserialize Token",
  () => {
    blackbox(JSON.parse(v2));
  },
  5_000_000,
  utf8ByteLength(v2),
);
dumpToFile("token", "deserialize");
