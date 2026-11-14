// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";


@json class Base {
  anchor: i32 = 1;
}


@json class State extends Base {

  @optional value: i32 = 7;


  @optional other: i32 = 8;
}
export function run(pretty: bool): string {
  const source = pretty
    ? '{ "anchor": 1, "other": 2 }'
    : '{"anchor":1,"other":2}';
  const out = JSON.parse<State>('{"anchor":1,"value":99,"other":88}');
  const fresh = JSON.parse<State>(source);
  const reused = JSON.parse<State>(source, out);
  return (
    fresh.value.toString() +
    ":" +
    fresh.other.toString() +
    "|" +
    reused.value.toString() +
    ":" +
    reused.other.toString()
  );
}
