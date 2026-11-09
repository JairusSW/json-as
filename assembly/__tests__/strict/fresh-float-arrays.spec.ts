// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class FreshFloats {
  doubles!: f64[];
  singles!: f32[];
}

describe("Fresh numeric arrays preserve lengths, growth and independent ownership", () => {
  for (let length = 0; length <= 18; length++) {
    let input = "[";
    for (let i = 0; i < length; i++) {
      if (i) input += ",";
      input += (i - 4).toString() + ".25";
    }
    input += "]";
    const text = '{"doubles":' + input + ',"singles":' + input + "}";
    const a = JSON.parse<FreshFloats>(text);
    const b = JSON.parse<FreshFloats>(text);
    __collect();
    expect(JSON.stringify(a)).toBe(text);
    expect(a.doubles.length).toBe(length);
    expect(a.singles.length).toBe(length);
    for (let i = 0; i < length; i++) {
      // Text construction adds .25 to a signed integer, so negatives subtract.
      const value = i < 4 ? <f64>(i - 4) - 0.25 : <f64>(i - 4) + 0.25;
      expect(a.doubles[i]).toBe(value);
      expect(a.singles[i]).toBe(<f32>value);
    }
    // Cross both the small initial size and the runtime's normal growth sizes.
    for (let i = 0; i < 24; i++) {
      a.doubles.push(<f64>i + 0.5);
      a.singles.push(<f32>i + 0.5);
    }
    __collect();
    expect(a.doubles.length).toBe(length + 24);
    expect(a.singles.length).toBe(length + 24);
    expect(b.doubles.length).toBe(length);
    expect(b.singles.length).toBe(length);
    expect(a.doubles[length + 23]).toBe(23.5);
    expect(a.singles[length + 23]).toBe(<f32>23.5);
    if (length) {
      a.doubles[0] = 999;
      a.singles[0] = 999;
      expect(b.doubles[0]).toBe(-4.25);
      expect(b.singles[0]).toBe(<f32>-4.25);
    }
  }
});

describe("Fresh numeric pairs preserve signed zero and truncation on shorter input", () => {
  const value = JSON.parse<FreshFloats>(
    '{"doubles":[-0,1.25],"singles":[-0,1.25]}',
  );
  expect(reinterpret<u64>(value.doubles[0])).toBe(0x8000000000000000);
  expect(reinterpret<u32>(value.singles[0])).toBe(0x80000000);
  expect(JSON.stringify(value)).toBe('{"doubles":[0,1.25],"singles":[0,1.25]}');
  const short = JSON.parse<FreshFloats>('{"doubles":[2.5],"singles":[]}');
  __collect();
  expect(short.doubles.length).toBe(1);
  expect(short.doubles[0]).toBe(2.5);
  expect(short.singles.length).toBe(0);
  expect(value.doubles[1]).toBe(1.25);
});
