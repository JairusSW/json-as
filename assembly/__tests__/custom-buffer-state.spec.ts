// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { bs } from "../../lib/as-bs";
import { describe, expect } from "as-test";
let fragment = "x".repeat(4_000);


@json class LargeFragment {

  @serializer("any") serialize(self: LargeFragment): string {
    return fragment;
  }
}


@json class NestedFragment {

  @serializer("any") serialize(self: NestedFragment): string {
    JSON.stringify<string>("z".repeat(40_000));
    return "0";
  }
}
describe("custom return values reserve their current length", () => {
  bs.reset();
  bs.resize(32_768);
  bs.bufferSize = 1_024;
  const codec = new LargeFragment();
  codec.__SERIALIZE(changetype<usize>(codec));
  const fits = bs.offset >= bs.buffer && bs.offset - bs.buffer <= bs.bufferSize;
  bs.resize(32_768);
  bs.reset();
  expect(fits).toBe(true);
});
describe("custom nested serialization restores a relative position", () => {
  bs.reset();
  bs.resize(1_024);
  const blocker = new ArrayBuffer(16_384);
  const before = bs.buffer;
  const codec = new NestedFragment();
  codec.__SERIALIZE(changetype<usize>(codec));
  const moved = before != bs.buffer;
  const correct = bs.offset == bs.buffer + 2;
  bs.reset();
  expect(blocker.byteLength).toBe(16_384);
  expect(moved).toBe(true);
  expect(correct).toBe(true);
});
