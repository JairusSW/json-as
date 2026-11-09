// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";

let calls: i32 = 0;


@json class RawCodec extends JSON.Raw {
  constructor(data: string = "7") {
    super(data);
  }


  @deserializer("number") decode(_source: string): RawCodec {
    calls++;
    return new RawCodec("42");
  }
}
describe("raw subclasses keep custom readers in maps", () => {
  calls = 0;
  expect(JSON.parse<RawCodec>("7").data).toBe("42");
  expect(calls).toBe(1);
  calls = 0;
  expect(JSON.parse<RawCodec[]>("[7]")[0].data).toBe("42");
  expect(calls).toBe(1);
  calls = 0;
  expect(JSON.parse<Map<string, RawCodec>>('{"x":7}').get("x").data).toBe("42");
  expect(calls).toBe(1);
  calls = 0;
  const reused = new Map<string, RawCodec>();
  JSON.parse<Map<string, RawCodec>>('{"x":7}', reused);
  expect(reused.get("x").data).toBe("42");
  expect(calls).toBe(1);
});
