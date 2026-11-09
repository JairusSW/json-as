// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class PointerLazy {
  signed!: JSON.Lazy<isize>;
  unsigned!: JSON.Lazy<usize>;
}


@json class NativeLazyControl {
  value!: JSON.Lazy<u32>;
}
describe("lazy pointer-sized integers compile and preserve values", () => {
  expect(JSON.stringify(new NativeLazyControl())).toBe('{"value":0}');
  const out = JSON.parse<PointerLazy>('{"signed":7,"unsigned":8}');
  expect(out.signed).toBe(<isize>7);
  expect(out.unsigned).toBe(<usize>8);
  expect(JSON.stringify(out)).toBe('{"signed":7,"unsigned":8}');
});

describe("lazy pointer zeros preserve field numeric semantics", () => {
  expect(JSON.stringify<usize>(0)).toBe("null");
  expect(JSON.stringify(new PointerLazy())).toBe('{"signed":0,"unsigned":0}');
  const value = JSON.parse<PointerLazy>('{"signed":0,"unsigned":0}');
  expect(value.unsigned).toBe(<usize>0);
  expect(JSON.stringify(value)).toBe('{"signed":0,"unsigned":0}');
});
