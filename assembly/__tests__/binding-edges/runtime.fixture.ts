// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
type Item = i32;
type Identity<T> = T;
namespace M {
  type Item = f32;

  @json export class Row {
    value: Identity<Item> = 1.5;
  }
}

@json class Ancestor {
  base: i32 = 1;
}
class Middle extends Ancestor {
  middle: i32 = 2;
}

@json class Leaf extends Middle {
  leaf: i32 = 3;
}
class Plain {
  value: i32 = 1;
}

@json class Omitted extends Plain {

  @omit value: i32 = 2;
  leaf: i32 = 3;
}
class OmitMiddle extends Plain {

  @omit value: i32 = 2;
}

@json class OmitLeaf extends OmitMiddle {
  leaf: i32 = 3;
}
let calls: i32 = 0;
function next(): i32 {
  return ++calls;
}
class EffectBase {
  value: i32 = next();
}

@json class EffectChild extends EffectBase {
  tail: i32 = 0;
}
class Rows extends Array<i32[]> {

  @operator("[]=") assign(index: i32, value: i32[]): void {
    changetype<Array<i32[]>>(this)[index] = [value[0] + 1];
  }
}
class Seeded extends Rows {
  constructor() {
    super();
    changetype<Array<i32[]>>(this)[0] = [9];
  }
}
class Stamp extends Date {
  constructor(time: i64) {
    super(time);
  }
  setTime(time: i64): i64 {
    return super.setTime(time + 86400000);
  }
}
let reads: i32 = 0;
class Values extends Array<JSON.Value> {

  @operator("{}") read(_index: i32): JSON.Value {
    return JSON.Value.from<i32>(++reads);
  }
}
export function run(kind: i32): string {
  if (kind == 0) return JSON.stringify(new M.Row());
  if (kind == 1) return new M.Row().value.toString();
  if (kind == 2) return JSON.stringify(new Leaf());
  if (kind == 3)
    return JSON.stringify(JSON.parse<Leaf>('{"base":7,"middle":8,"leaf":9}'));
  if (kind == 4) return JSON.stringify(new Omitted());
  if (kind == 5) return JSON.stringify(new OmitLeaf());
  if (kind == 6) {
    calls = 0;
    const out = JSON.parse<EffectChild[]>('[{"tail":7}]');
    return out[0].value.toString() + ":" + calls.toString();
  }
  if (kind == 7) {
    const out = new Rows();
    changetype<Array<i32[]>>(out)[0] = [9];
    changetype<Array<i32[]>>(out)[1] = [9];
    return JSON.stringify(JSON.parse<Rows>("[[1],[2],[3]]", out));
  }
  if (kind == 8) return JSON.stringify(JSON.parse<Seeded>("[[1],[2]]"));
  if (kind == 9) {
    const out = JSON.parse<Stamp>('"1970-01-02T00:00:00.000Z"', new Stamp(0));
    return out.getTime().toString();
  }
  const source = new Values();
  changetype<Array<JSON.Value>>(source)[0] = JSON.Value.from<i32>(7);
  changetype<Array<JSON.Value>>(source)[1] = JSON.Value.from<i32>(8);
  reads = 0;
  const out =
    kind == 10
      ? JSON.stringify(JSON.Arr.from(source))
      : JSON.stringify(JSON.Value.from(source));
  return out + ":" + reads.toString();
}
