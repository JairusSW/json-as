// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
let calls: i32 = 0;


@json class MapCodec {
  n: i32 = 0;


  @deserializer("number") decode(source: string): MapCodec {
    calls++;
    const out = new MapCodec();
    out.n = JSON.parse<i32>(source);
    return out;
  }
}


@json class CodecOwner {
  values: Map<string, MapCodec> = new Map();
  second: i32 = 0;
}
describe("map codec effects do not depend on layout", () => {
  const inputs = [
    '{"values":{"x":1},"second":2}',
    '{"values":{"x":1}, "second":2}',
    '{\n  "values": {"x":1},\n  "second":2\n}',
    '{"second":2,"values":{"x":1}}',
  ];
  for (let i = 0; i < inputs.length; i++) {
    calls = 0;
    const value = JSON.parse<CodecOwner>(inputs[i]);
    expect(calls).toBe(1);
    expect(value.values.get("x").n).toBe(1);
    expect(value.second).toBe(2);
  }
});
