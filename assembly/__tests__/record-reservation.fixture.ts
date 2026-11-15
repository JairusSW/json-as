// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { bs } from "../../lib/as-bs";

export function recordLength(): usize {
  return bs.recordDiagnosticLength();
}

export function recordReservation(): usize {
  return bs.recordDiagnosticReservation();
}


@json({ nolazy })
class Row {
  value: i64 = 7;
  text: string = "x".repeat(384);
}


@json({ nolazy })
class Document {
  rows: Row[] = [];
  tail: i32 = 9;
}

const document = new Document();

export function resize(count: i32): void {
  document.rows.length = 0;
  for (let i = 0; i < count; i++) document.rows.push(new Row());
}

export function change(): void {
  document.rows[0].value = 17;
  document.rows[0].text = 'changed\n"';
}

export function write(): string {
  return JSON.stringify(document);
}
