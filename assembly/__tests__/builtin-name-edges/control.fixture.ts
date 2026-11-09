// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";


@json
class ByteModel {
  value: i32 = 3;
}


@json
class Holder {
  child: ByteModel = new ByteModel();
}


@json
class Native {
  bytes: Uint8Array = new Uint8Array(0);
  rows: Array<i32> = [];
}
export function run(kind: i32): i32 {
  if (kind == 0) return JSON.parse<ByteModel>('{"value":7}').value;
  if (kind == 1)
    return JSON.parse<ByteModel>('{"value":7}', new ByteModel()).value;
  if (kind == 2) return JSON.parse<Holder>('{"child":{"value":7}}').child.value;
  return JSON.parse<Holder>('{"child":{"value":7}}', new Holder()).child.value;
}
export function native(reuse: bool): string {
  const source = '{"bytes":[1,2],"rows":[3,4]}';
  const value = reuse
    ? JSON.parse<Native>(source, new Native())
    : JSON.parse<Native>(source);
  return JSON.stringify(value);
}
export function roundtrip(): string {
  return JSON.stringify(JSON.parse<Holder>('{"child":{"value":7}}'));
}
