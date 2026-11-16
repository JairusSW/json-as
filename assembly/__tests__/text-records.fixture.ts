// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";


@json({nolazy}) class TextRecord {
  a!: string;
  b!: string;
  c!: string;
}
export function allocInput(bytes: i32): usize {
  return __new(bytes, idof<string>());
}
let rootRows: TextRecord[] | null = null;
const record = new TextRecord();
export function run(source: string): string {
  const values = JSON.parse<string[]>(source);
  const rows: TextRecord[] = new Array<TextRecord>();
  for (let i = 0; i < values.length; i++) {
    const r = new TextRecord();
    r.a = values[i];
    r.b = values[i];
    r.c = values[i];
    rows.push(r);
  }
  return JSON.stringify(rows);
}
export function reuse(source: string): string {
  record.a = source;
  record.b = source;
  record.c = source;
  return JSON.stringify([record]);
}
