// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";


@json class Scalar {
  value: i32 = 0;
}


@json class Item {
  marker: i32 = 0;
  message: string = "";
  values: i32[] = [];
  link: Item | null = null;
}


@json class Pad2 extends Item {
  p0: f64 = 0;
  p1: f64 = 0;
}


@json class Pad4 extends Item {
  p0: f64 = 0;
  p1: f64 = 0;
  p2: f64 = 0;
  p3: f64 = 0;
}


@json class Pad6 extends Item {
  p0: f64 = 0;
  p1: f64 = 0;
  p2: f64 = 0;
  p3: f64 = 0;
  p4: f64 = 0;
  p5: f64 = 0;
}


@json class Pad8 extends Item {
  p0: f64 = 0;
  p1: f64 = 0;
  p2: f64 = 0;
  p3: f64 = 0;
  p4: f64 = 0;
  p5: f64 = 0;
  p6: f64 = 0;
  p7: f64 = 0;
}


@json class Pad10 extends Item {
  p0: f64 = 0;
  p1: f64 = 0;
  p2: f64 = 0;
  p3: f64 = 0;
  p4: f64 = 0;
  p5: f64 = 0;
  p6: f64 = 0;
  p7: f64 = 0;
  p8: f64 = 0;
  p9: f64 = 0;
}


@json class Pad12 extends Item {
  p0: f64 = 0;
  p1: f64 = 0;
  p2: f64 = 0;
  p3: f64 = 0;
  p4: f64 = 0;
  p5: f64 = 0;
  p6: f64 = 0;
  p7: f64 = 0;
  p8: f64 = 0;
  p9: f64 = 0;
  p10: f64 = 0;
  p11: f64 = 0;
}

let kept = new Array<Item | null>(32);
let markers = new Int32Array(32);
let runtimeIds = new Uint32Array(32);
let expectedText = new Array<string>(32);
let turn: i32 = 0;
function checkAll(): void {
  for (let i = 0; i < 32; i++) {
    const value = kept[i];
    if (value === null) continue;
    assert(value.marker == markers[i]);
    assert(value.message == expectedText[i]);
    assert(value.values.length >= 3 && value.values[0] == (markers[i] ^ 0x55));
    const header = changetype<OBJECT>(
      changetype<usize>(value) - TOTAL_OVERHEAD,
    );
    assert(header.rtId == runtimeIds[i]);
  }
}
function exercise<T extends Item>(extra: string, iterations: i32): void {
  for (let i = 0; i < iterations; i++) {
    const marker = ++turn;
    const message = "x".repeat((marker & 31) + 1);
    const source =
      '{"marker":' +
      marker.toString() +
      ',"message":"' +
      message +
      '","values":[1,2,3],"link":null' +
      extra +
      "}";
    const value = JSON.parse<T>(source);
    assert(JSON.stringify(value) == source);
    const slot = marker & 31;
    for (let j = 0; j < 32; j++)
      if (j != slot && kept[j] !== null) {
        assert(changetype<usize>(value) != changetype<usize>(kept[j]));
        assert(value.values !== kept[j]!.values);
      }
    value.values[0] = marker ^ 0x55;
    kept[slot] = value;
    markers[slot] = marker;
    runtimeIds[slot] = idof<T>();
    expectedText[slot] = message;
    // Mix standard allocations/renewals with neighboring batched blocks.
    const bytes = new Uint8Array(17 + (marker & 127));
    bytes[bytes.length - 1] = 123;
    if ((marker & 3) == 0) {
      __collect();
      checkAll();
    }
    if ((marker & 15) == 0) {
      value.values.length = 64;
      value.values[63] = marker;
      __collect();
      assert(value.values[63] == marker);
    }
    assert(bytes[bytes.length - 1] == 123);
  }
}
export function verify(): i32 {
  for (let round = 0; round < 3; round++) {
    exercise<Item>("", 128);
    exercise<Pad2>(',"p0":0.5,"p1":1.5', 128);
    exercise<Pad4>(',"p0":0.5,"p1":1.5,"p2":2.5,"p3":3.5', 128);
    exercise<Pad6>(
      ',"p0":0.5,"p1":1.5,"p2":2.5,"p3":3.5,"p4":4.5,"p5":5.5',
      128,
    );
    exercise<Pad8>(
      ',"p0":0.5,"p1":1.5,"p2":2.5,"p3":3.5,"p4":4.5,"p5":5.5,"p6":6.5,"p7":7.5',
      128,
    );
    exercise<Pad10>(
      ',"p0":0.5,"p1":1.5,"p2":2.5,"p3":3.5,"p4":4.5,"p5":5.5,"p6":6.5,"p7":7.5,"p8":8.5,"p9":9.5',
      128,
    );
    exercise<Pad12>(
      ',"p0":0.5,"p1":1.5,"p2":2.5,"p3":3.5,"p4":4.5,"p5":5.5,"p6":6.5,"p7":7.5,"p8":8.5,"p9":9.5,"p10":10.5,"p11":11.5',
      128,
    );

    for (let i = 0; i < 64; i++) {
      const value = JSON.parse<Scalar>('{"value":7}');
      assert(value.value == 7);
      __collect();
    }
    checkAll();
    kept[0]!.link = kept[1];
    kept[1]!.link = kept[0];
    __collect();
    assert(kept[0]!.link === kept[1] && kept[1]!.link === kept[0]);
    for (let i = 0; i < 32; i++) kept[i] = null;
    __collect();
  }
  return 1;
}
