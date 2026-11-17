// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";


@json class Owner {
  date!: Date;

  raw!: JSON.Raw;

  box!: JSON.Box<i32>;

  bytes!: Uint8Array;

  arbitrary: JSON.Value = JSON.Value.empty();
}


@json({lazy: true}) class Auto {
  date!: Date;
}
export function run(): string {
  const source =
    '{"date":"1970-01-01T00:00:00.000Z","raw":7,"box":7,"bytes":[1,2],"arbitrary":7}';
  const out = JSON.parse<Owner>(source);
  assert(
    JSON.parse<Auto>('{"date":"1970-01-01T00:00:00.000Z"}').date.getTime() == 0,
  );
  assert(new Owner().arbitrary.type == JSON.Types.Null);
  return JSON.stringify(out);
}
