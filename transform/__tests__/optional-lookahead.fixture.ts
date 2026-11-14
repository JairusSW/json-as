// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../assembly/index";
let preparations: i32 = 0;
// Called by generated instrumentation rather than a source-level reference.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function recordLookahead(): void {
  preparations++;
}
export function lookaheadCount(): i32 {
  return preparations;
}


@json class Row {

  @optional a: i64 = 7;


  @optional b: string | null = null;


  @optional c: i64[] = [];


  @optional d: JSON.Raw | null = null;


  @optional e: bool = false;


  @optional end: i32 = 0;
}


@json class Mixed {
  first: i32 = 1;


  @optional a: i32 = 2;


  @optional b: i32 = 3;
  last: i32 = 4;
}


@json class Rows {
  values: Row[] = [];
}
let effects: i32 = 0;
function next(): i32 {
  return ++effects;
}


@json class Effect {

  @optional a: i32 = next();


  @optional b: i32 = 0;
}
export function verify(): i32 {
  const sources = [
    "{}",
    '{ "end":9 }',
    '{ "a":1, "end":9 }',
    '{ "b":"x", "e":true, "end":9 }',
    '{ "a" : 1 \n , \t "c" : [1,2], \n "end":9 }',
    '{ "e":true, "a":1, "end":9 }',
    '{ "a":1, "a":2, "c":[1], "c":[], "end":9 }',
    '{ "c":[], "d":null, "end":9 }',
  ];
  for (let i = 0; i < sources.length; i++) {
    const fresh = JSON.parse<Row>(sources[i]);
    const out = JSON.parse<Row>(
      '{"a":99,"b":"old","c":[9],"d":[1],"e":true,"end":88}',
    );
    JSON.parse<Row>(sources[i], out);
    assert(JSON.stringify(fresh) == JSON.stringify(out));
    if (i == 0) {
      assert(
        out.a == 7 &&
          out.b === null &&
          out.c.length == 0 &&
          out.d === null &&
          !out.e &&
          out.end == 0,
      );
    }
    if (i == 1) {
      assert(out.a == 7 && out.end == 9);
    }
    if (i == 3) {
      assert(out.b == "x" && out.e && out.end == 9);
    }
    if (i == 4) {
      assert(out.a == 1 && out.c.length == 2 && out.c[1] == 2);
    }
    if (i == 6) {
      assert(out.a == 2 && out.c.length == 0);
    }
  }
  const mixed = JSON.parse<Mixed>('{ "first":7, "last":9 }');
  assert(mixed.a == 2 && mixed.b == 3 && mixed.first == 7 && mixed.last == 9);
  const nested = JSON.parse<Rows>(
    '{ "values" : [{ "end":1 },{ "b":"x", "end":2 }] }',
  );
  JSON.parse<Rows>(
    '{ "values" : [{ "e":true, "end":3 },{ "a":5, "end":4 },{ "end":5 }] }',
    nested,
  );
  assert(
    nested.values.length == 3 &&
      nested.values[0].e &&
      nested.values[0].a == 7 &&
      nested.values[1].a == 5 &&
      nested.values[1].b === null &&
      nested.values[2].end == 5,
  );
  effects = 0;
  const effect = JSON.parse<Effect>('{ "b":7 }');
  assert(effects == 1 && effect.a == 1 && effect.b == 7);
  return 1;
}


@json
class Probe {

  @optional a: i32 = 0;


  @optional b: i32 = 0;


  @optional c: i32 = 0;


  @optional d: i32 = 0;


  @optional e: i32 = 0;


  @optional f: i32 = 0;
}
export function probeCount(which: i32): i32 {
  const out = new Probe();
  const data =
    which == 0
      ? "{ \n }"
      : which == 1
        ? '{ \n "f":6 }'
        : which == 2
          ? '{ \n "a":1, "f":6 }'
          : '{ \n "c":3 }';
  preparations = 0;
  JSON.parse<Probe>(data, out);
  assert(
    out.a == (which == 2 ? 1 : 0) &&
      out.c == (which == 3 ? 3 : 0) &&
      out.f == (which == 1 || which == 2 ? 6 : 0),
  );
  return preparations;
}

export function verifyMasks(): i32 {
  const fields = [
    '"a":9',
    '"b":"x"',
    '"c":[1,2]',
    '"d":{"n":2}',
    '"e":true',
    '"end":6',
  ];
  let checked = 0;
  for (let pretty = 0; pretty < 2; pretty++)
    for (let mask = 0; mask < 64; mask++) {
      let data = pretty ? "{\n " : "{";
      let present = false;
      for (let field = 0; field < 6; field++)
        if (mask & (1 << field)) {
          if (present) data += pretty ? ",\n\t" : ",";
          data += fields[field];
          present = true;
        }
      data += pretty ? "\n}" : "}";
      const fresh = JSON.parse<Row>(data);
      const out = JSON.parse<Row>(
        '{"a":99,"b":"old","c":[9],"d":[1],"e":true,"end":88}',
      );
      JSON.parse<Row>(data, out);
      assert(JSON.stringify(fresh) == JSON.stringify(out));
      assert(out.a == (mask & 1 ? 9 : 7));
      assert(out.b == (mask & 2 ? "x" : null));
      assert(out.c.length == (mask & 4 ? 2 : 0));
      assert((out.d !== null) == ((mask & 8) != 0));
      assert(out.e == ((mask & 16) != 0));
      assert(out.end == (mask & 32 ? 6 : 0));
      checked++;
    }
  return checked;
}
