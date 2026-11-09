// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
let calls = 0;


@json class CountedCodec {
  value: i32 = 0;


  @deserializer("number") decode(source: string): CountedCodec {
    calls++;
    const out = new CountedCodec();
    out.value = JSON.parse<i32>(source);
    return out;
  }
}


@json class CodecOwner {
  first: CountedCodec = new CountedCodec();
  second: i32 = 0;
}
describe("layout fallback does not replay user deserializers", () => {
  calls = 0;
  expect(JSON.parse<CodecOwner>('{"first":1, "second":2}').first.value).toBe(1);
  expect(calls).toBe(1);
  if (!JSON_STRICT) {
    calls = 0;
    expect(
      JSON.parse<CodecOwner>('{"first":1,"second":2,"extra":3}').second,
    ).toBe(2);
    expect(calls).toBe(1);
  }
});
