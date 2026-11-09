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

let kept: Pure[] | null = null;
export function allocationCase(): i32 {
  const out = JSON.parse<Pure[]>(
    '[{"n":9,"values":[],"others":[],"text":"new","tail":3}]',
    new Array<Pure>(),
  );
  const row = out[0];
  assert(row.n == 9 && row.values.length == 0 && row.others.length == 0);
  assert(row.text == "new" && row.tail == 3);
  kept = out;
  return 1;
}

export function verify(): i32 {
  const documents = [
    '[{}]',
    '[{"tail":9}]',
    '[{"tail":9,"n":2}]',
    '[{"tail":9,"text":"default","n":2}]',
  ];
  for (let i = 0; i < documents.length; i++) {
    const fresh = JSON.parse<Pure[]>(documents[i], new Array<Pure>());
    const out = JSON.parse<Pure[]>(
      '[{"n":99,"values":[1,2],"others":["old"],"text":"old","tail":88}]',
    );
    const old = out[0];
    const values = old.values;
    JSON.parse<Pure[]>(documents[i], out);
    const row = out[0];
    assert(row === old);
    assert(row.n == (i < 2 ? 7 : 2));
    assert(row.tail == (i == 0 ? 0 : 9));
    assert(row.text == "default" && row.values.length == 0 && row.others.length == 0);
    assert(values.length == 2 && values[0] == 1);
    assert(JSON.stringify(fresh) == JSON.stringify(out));
  }
  const nullable = JSON.parse<(Pure | null)[]>('[null,{"tail":9},null]', []);
  assert(nullable[0] === null && nullable[2] === null);
  assert(nullable[1]!.n == 7 && nullable[1]!.tail == 9);
  const fixed = JSON.parse<StaticArray<Pure>>('[{"tail":9},{}]');
  assert(fixed[0].n == 7 && fixed[0].tail == 9);
  assert(fixed[1].n == 7 && fixed[1].tail == 0);
  const one = new Pure();
  const aliases: Pure[] = [one, one];
  JSON.parse<Pure[]>('[{"n":1},{"n":2}]', aliases);
  assert(aliases[0] !== aliases[1] && aliases[0].n == 1 && aliases[1].n == 2);
  calls = 0;
  const effect = JSON.parse<Effect[]>('[{"tail":9}]', new Array<Effect>());
  assert(calls == 1 && effect[0].first == 1);
  const internal = JSON.parse<Internal[]>('[{"tail":9}]', new Array<Internal>());
  assert(internal[0].read() == 19 && internal[0].n == 7);
  const sharing = JSON.parse<Shared[]>('[{"tail":9}]', new Array<Shared>());
  assert(sharing[0].child === shared);
  const named = JSON.parse<Model.Named[]>('[{"tail":9}]', new Array<Model.Named>());
  assert(named[0].value == 13);
  readerState = 0;
  const observed = JSON.parse<ObservedDefault[]>(
    '[{"child":{"n":7}}]', new Array<ObservedDefault>(),
  );
  assert(readerState == 1 && observed[0].saved == 0);
  assert(observed[0].child!.n == 7);
  __collect();
  assert(kept![0].n == 9 && kept![0].text == "new");
  return 1;
}
