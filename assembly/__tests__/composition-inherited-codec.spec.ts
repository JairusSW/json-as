// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class ParentCodec {
  value: i32 = 0;


  @deserializer("number") decode(data: string): ParentCodec {
    const out = new ParentCodec();
    out.value = JSON.parse<i32>(data);
    return out;
  }
}


@json class ChildCodec extends ParentCodec {

  @deserializer("number") decode(data: string): ChildCodec {
    const out = new ChildCodec();
    out.value = JSON.parse<i32>(data) + 1;
    return out;
  }
}


@json class CodecField {
  value: ParentCodec = new ParentCodec();
}
describe("custom readers retain valid dispatch with inheritance", () => {
  expect(new ParentCodec().decode("7").value).toBe(7);
  expect(JSON.parse<ChildCodec>("7").value).toBe(8);
  expect(JSON.parse<ParentCodec>("7").value).toBe(7);
  expect(JSON.parse<CodecField>('{"value":7}').value.value).toBe(7);
});
