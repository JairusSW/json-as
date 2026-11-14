// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { appendNativeArray } from "../util/nativeArray";


@json
export class WarningRow {
  value: i32 = 0;
  label: string = "";
}


@json
class ExtendedRow extends WarningRow {
  extra: i32 = 0;
}


@json
class WarningOwner {
  rows: WarningRow[] = [];
  bytes: Uint8Array = new Uint8Array(0);
  buffer: ArrayBuffer = new ArrayBuffer(0);
}

export function verify(): string {
  const source =
    '{"rows":[{"value":7,"label":"x"}],"bytes":[1,2],"buffer":[3,4]}';
  const out = JSON.parse<WarningOwner>(source);
  JSON.parse<WarningOwner>(source, out);
  const raw = JSON.parse<JSON.Raw>('{"n":7}', new JSON.Raw("0"));
  const values = new Array<i64>();
  appendNativeArray<i64[]>(values, 7);
  const base: WarningRow = new ExtendedRow();
  base.value = 9;
  assert(JSON.stringify<WarningRow>(base).includes('"extra":0'));
  return JSON.stringify(out) + "|" + raw.data + "|" + JSON.stringify(values);
}
