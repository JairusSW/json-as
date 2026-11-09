// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bench, blackbox, dumpToFile } from "../lib/bench.js";
/* global read, writeFile, print */
// V8 shell runner: built-in JSON APIs with the v1.6.1 checkpoint blackbox.
const [input, rawOps, oracle, mode, rawBytes] = globalThis.arguments;
const text = read(input);
const object = JSON.parse(text);
writeFile(oracle, JSON.stringify(object));
const ops = Number(rawOps),
  bytes = Number(rawBytes);
if (!(ops > 0 && bytes > 0)) throw Error("Invalid benchmark dimensions");
function measure(kind, routine) {
  bench(`Built-in JSON ${kind}`, () => blackbox(routine()), ops, bytes);
  const originalWrite = globalThis.writeFile;
  globalThis.writeFile = (_path, data) => {
    const result = JSON.parse(data);
    print("BASELINE " + JSON.stringify({ ...result, kind }));
  };
  try {
    dumpToFile("comparison", kind);
  } finally {
    globalThis.writeFile = originalWrite;
  }
}
if (mode !== "check") {
  measure("deserialize", () => JSON.parse(text));
  measure("serialize", () => JSON.stringify(object));
}
