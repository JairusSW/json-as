// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class CustomMap extends Map<string, i32> {
  text: string = "";


  @deserializer("string") decode(source: string): CustomMap {
    const out = new CustomMap();
    out.text = JSON.parse<string>(source);
    return out;
  }
}
describe("static array element overrides precede builtins", () => {
  expect(JSON.parse<StaticArray<CustomMap>>('["hello"]')[0].text).toBe("hello");
});
