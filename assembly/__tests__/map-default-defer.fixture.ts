// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";

@json
class Pure {
  @optional n: i32 = 7;
  @optional values: i32[] = [];
  @optional others: string[] = [];
  @optional text: string = "default";
  @optional tail: i32 = 0;
}

@json
class Internal extends Pure {
  private hidden: i32 = 19;
  read(): i32 { return this.hidden; }
}

let calls: i32 = 0;
class Defaults {
  static get next(): i32 { return ++calls; }
}
@json
class Effect {
  @optional first: i32 = Defaults.next;
  @optional tail: i32 = 0;
}

const shared = new Pure();
@json
class Shared {
  @optional child: Pure = shared;
  @optional tail: i32 = 0;
}

let readerState: i32 = 0;
@json
class Manual {
  n: i32 = 0;
  __DESERIALIZE_FAST<T>(start: usize, end: usize, out: T, reset: bool): usize {
    readerState++;
    return 0;
  }
}
@json
class ObservedDefault {
  @optional saved: i32 = readerState;
  @optional child: Manual | null = null;
}

namespace Model {
  @json
  export class Named {
    @optional value: i32 = 13;
    @optional tail: i32 = 0;
  }
}

let kept: Map<string, Pure> | null = null;
export function allocationCase(): i32 {
  const out = JSON.parse<Map<string, Pure>>(
    '{"x":{"n":9,"values":[],"others":[],"text":"new","tail":3}}',
    new Map<string, Pure>(),
  );
  const row = out.get("x");
  assert(row.n == 9 && row.values.length == 0 && row.others.length == 0);
  assert(row.text == "new" && row.tail == 3);
  kept = out;
  return 1;
}

export function verify(): i32 {
  const documents = [
    '{"x":{}}',
    '{"x":{"tail":9}}',
    '{"x":{"tail":9,"n":2}}',
    '{"x":{"tail":9,"text":"default","n":2}}',
  ];
  for (let i = 0; i < documents.length; i++) {
    const fresh = JSON.parse<Map<string, Pure>>(documents[i], new Map<string, Pure>());
    const out = JSON.parse<Map<string, Pure>>(
      '{"x":{"n":99,"values":[1,2],"others":["old"],"text":"old","tail":88}}',
    );
    const old = out.get("x");
    const values = old.values;
    JSON.parse<Map<string, Pure>>(documents[i], out);
    const row = out.get("x");
    assert(row === old);
    assert(row.n == (i < 2 ? 7 : 2));
    assert(row.tail == (i == 0 ? 0 : 9));
    assert(row.text == "default" && row.values.length == 0 && row.others.length == 0);
    assert(values.length == 2 && values[0] == 1);
    assert(JSON.stringify(fresh) == JSON.stringify(out));
  }
  calls = 0;
  const effect = JSON.parse<Map<string, Effect>>('{"x":{"tail":9}}', new Map<string, Effect>());
  assert(calls == 1 && effect.get("x").first == 1);
  const internal = JSON.parse<Map<string, Internal>>('{"x":{"tail":9}}', new Map<string, Internal>());
  assert(internal.get("x").read() == 19 && internal.get("x").n == 7);
  const sharing = JSON.parse<Map<string, Shared>>('{"x":{"tail":9}}', new Map<string, Shared>());
  assert(sharing.get("x").child === shared);
  const named = JSON.parse<Map<string, Model.Named>>('{"x":{"tail":9}}', new Map<string, Model.Named>());
  assert(named.get("x").value == 13);
  readerState = 0;
  const observed = JSON.parse<Map<string, ObservedDefault>>(
    '{"x":{"child":{"n":7}}}', new Map<string, ObservedDefault>(),
  );
  assert(readerState == 1 && observed.get("x").saved == 0);
  assert(observed.get("x").child!.n == 7);
  __collect();
  assert(kept!.get("x").n == 9 && kept!.get("x").text == "new");
  return 1;
}
