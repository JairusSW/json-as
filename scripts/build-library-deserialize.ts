// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { buildMultilibChart } from "./lib/multilib-chart";

// Multi-library DESERIALIZE throughput on the ~1 KiB multilib payload:
// json-as struct/JSON.Obj (NAIVE/SWAR/SIMD) + assemblyscript-json (wasm) vs
// native JSON + fast-json-parse (JS), each in its own fresh V8.
buildMultilibChart("deserialize", "./build/charts/library-deserialize.png");
