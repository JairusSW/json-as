// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

globalThis.print = function print(message = "") {
  console.log(message);
};

globalThis.read = function read(path) {
  return readFileSync(path, "utf8");
};

globalThis.writeFile = function writeFile(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
};

const target = process.argv[2];
if (!target) {
  throw new Error("Missing compiled benchmark module path");
}

await import(resolve(target));
