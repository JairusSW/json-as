// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { instantiate } from "as-test/lib";

const wasmPath = process.argv[2];
if (!wasmPath) throw new Error("Expected a WebAssembly test file path");

process.env.AS_TEST_WASM_PATH = wasmPath;
const instance = await instantiate({});
instance.exports.start?.();
