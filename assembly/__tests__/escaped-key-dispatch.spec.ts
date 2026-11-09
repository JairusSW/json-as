// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class EscapedKey {
  name: string = "default";
  id: i32 = 7;
}
describe("escaped key dispatch matches literal keys for fresh and reused objects", () => {
  const source = '{"na\\u006de":"updated","id":7}';
  expect(JSON.parse<EscapedKey>(source).name).toBe("updated");
  const out = new EscapedKey();
  expect(JSON.parse<EscapedKey>(source, out).name).toBe("updated");
});


@json class SpecialKeys {

  @alias('q"key') quote: string = "default";


  @alias("slash\\") slash: i32 = 0;
}
describe("escaped aliases dispatch decoded UTF-16 including trailing slashes", () => {
  const source = '{"q\\u0022key":"ok","slash\\\\":9}';
  const value = JSON.parse<SpecialKeys>(source);
  expect(value.quote).toBe("ok");
  expect(value.slash).toBe(9);
});
