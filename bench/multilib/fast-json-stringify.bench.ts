// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import {
  bench,
  blackbox,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench.js";
import Fjs from "fast-json-stringify";
import {
  JS_FAST_STRINGIFY_OPS,
  MULTILIB_PAYLOAD_FILE,
  schema,
} from "./shared.js";

const payload = readFile(MULTILIB_PAYLOAD_FILE);
const obj = JSON.parse(payload);
const fastStringify = Fjs(schema);

bench(
  "Serialize Multilib Payload (fast-json-stringify)",
  () => {
    blackbox(fastStringify(obj));
  },
  JS_FAST_STRINGIFY_OPS,
  utf8ByteLength(payload),
);
dumpToFile("multilib-fast-json-stringify", "serialize");
