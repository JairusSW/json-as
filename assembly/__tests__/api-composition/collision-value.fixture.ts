// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";


@json class Row {
  __name_val: string = "ordinary";
  name: JSON.Lazy<string> = "default";
}
export function run(): string {
  const out = JSON.parse<Row>('{"name":"default"}');
  assert(out.name == "default");
  return JSON.stringify(out);
}
