// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
class PrivateBase {
  private hidden: i32 = 7;
  value!: i32;
  read(): i32 {
    return this.hidden;
  }
}

@json class PrivateChild extends PrivateBase {
  tail!: i32;
}
class ProtectedBase {
  protected hidden: i32 = 7;
  value!: i32;
  read(): i32 {
    return this.hidden;
  }
}

@json class ProtectedChild extends ProtectedBase {
  tail!: i32;
}
class OmitBase {

  @omit hidden: i32 = 7;
  value!: i32;
  read(): i32 {
    return this.hidden;
  }
}

@json class OmitChild extends OmitBase {
  tail!: i32;
}

@json class Grandparent {
  private hidden: i32 = 7;
  value!: i32;
  read(): i32 {
    return this.hidden;
  }
}
class Middle extends Grandparent {}

@json class Grandchild extends Middle {
  tail!: i32;
}
let source: string = "";
let calls: i32 = 0;
let sameOwner: bool = false;

@json class Probe {

  @deserializer("object") decode(data: string): Probe {
    calls++;
    sameOwner =
      changetype<usize>(JSON.Util.getParseSource()) ==
      changetype<usize>(source);
    return new Probe();
  }
}

@json class LazyBase {
  payload!: JSON.Lazy<Probe>;
}
class LazyMiddle extends LazyBase {
  mid: i32 = 1;
}

@json class DecoratedMiddle extends LazyBase {
  mid: i32 = 1;
}

@json class DecoratedLeaf extends DecoratedMiddle {
  own!: JSON.Lazy<i32>;
  tail: i32 = 0;
}

@json class EagerLeaf extends LazyMiddle {
  own: i32 = 0;
  tail: i32 = 0;
}

@json class LazyLeaf extends LazyMiddle {
  own!: JSON.Lazy<i32>;
  tail: i32 = 0;
}
class IncrementMap extends Map<string, i32> {
  set(key: string, value: i32): this {
    super.set(key, value + 1);
    return this;
  }
}
class ShiftedMap extends Map<string, i32> {
  values(): i32[] {
    const out = super.values();
    for (let i = 0; i < out.length; i++) out[i] += 10;
    return out;
  }
  storedValues(): i32[] {
    return super.values();
  }
}
export function run(kind: i32, reuse: bool): string {
  const input = '{"value":1,"tail":2}';
  if (kind == 0)
    return JSON.parse<PrivateChild>(
      input,
      reuse ? new PrivateChild() : changetype<PrivateChild>(0),
    )
      .read()
      .toString();
  if (kind == 1)
    return JSON.parse<ProtectedChild>(
      input,
      reuse ? new ProtectedChild() : changetype<ProtectedChild>(0),
    )
      .read()
      .toString();
  if (kind == 2)
    return JSON.parse<OmitChild>(
      input,
      reuse ? new OmitChild() : changetype<OmitChild>(0),
    )
      .read()
      .toString();
  if (kind == 3)
    return JSON.parse<Grandchild>(
      input,
      reuse ? new Grandchild() : changetype<Grandchild>(0),
    )
      .read()
      .toString();
  if (kind == 4)
    return JSON.parse<PrivateChild[]>("[" + input + "]")[0]
      .read()
      .toString();
  if (kind == 5) return new PrivateChild().read().toString();
  if (kind == 6 || kind == 11 || kind == 12) {
    source = '{"payload":{},"mid":1,"own":2,"tail":3}';
    if (kind == 11) {
      const out = JSON.parse<DecoratedLeaf>(
        source,
        reuse ? new DecoratedLeaf() : changetype<DecoratedLeaf>(0),
      );
      assert(out.payload !== null);
    } else if (kind == 12) {
      const out = JSON.parse<EagerLeaf>(
        source,
        reuse ? new EagerLeaf() : changetype<EagerLeaf>(0),
      );
      assert(out.payload !== null);
    } else {
      const out = JSON.parse<LazyLeaf>(
        source,
        reuse ? new LazyLeaf() : changetype<LazyLeaf>(0),
      );
      assert(out.payload !== null);
    }
    return sameOwner.toString() + ":" + calls.toString();
  }
  if (kind == 7)
    return JSON.stringify(JSON.parse<IncrementMap>('{"a":1,"b":2}'));
  if (kind == 8)
    return JSON.stringify(JSON.parse<IncrementMap>('{"a":1,"\\u0062":2}'));
  if (kind == 9)
    return JSON.stringify(
      JSON.parse<IncrementMap>('{"a":1,"b":2}', new IncrementMap()),
    );
  const map = new ShiftedMap();
  map.set("a", 1);
  map.set("b", 2);
  assert(JSON.stringify(map) == '{"a":1,"b":2}');
  const converted = kind == 13 ? JSON.Obj.from<Map<string, i32>>(map) : JSON.Obj.from(map);
  assert(map.storedValues().join(",") == "1,2");
  return JSON.stringify(converted);
}
