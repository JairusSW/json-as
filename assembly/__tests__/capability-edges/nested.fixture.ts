// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";


@json class Generic<T> {
  value!: T;
}


@json class Root {
  field!: Generic<i32>;
  items: Array<Generic<i32>> = [];
}
export function run(pretty: bool): string {
  assert(JSON.parse<Generic<i32>>('{"value":7}').value == 7);
  assert(JSON.parse<Generic<i32>[]>('[{"value":7}]')[0].value == 7);
  return JSON.stringify(
    JSON.parse<Root>(
      pretty
        ? '{ \"field\": { \"value\": 7 }, \"items\": [{ \"value\": 8 }] }'
        : '{"field":{"value":7},"items":[{"value":8}]}',
    ),
  );
}
