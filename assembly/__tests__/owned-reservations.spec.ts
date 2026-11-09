// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { bs } from "../../lib/as-bs";
import { describe, expect } from "as-test";

function start(): void {
  bs.reset();
  JSON.stringify("a".repeat(40_000));
  bs.beginOwned();
  bs.proposeSize(80_004);
  bs.offset += 2;
}

describe("owned growth preserves outstanding reservations", () => {
  start();
  bs.growSize(2_000);
  const sufficient = bs.bufferSize >= bs.stackSize;
  bs.reset();
  expect(sufficient).toBe(true);
});
describe("owned vector growth preserves outstanding reservations", () => {
  start();
  bs.prepareGrowth(2_000, 2_000);
  const sufficient = bs.bufferSize >= bs.stackSize + 2_000;
  bs.reset();
  expect(sufficient).toBe(true);
});
describe("owned proposals preserve earlier reservations", () => {
  start();
  bs.proposeSize(2_000);
  const sufficient = bs.bufferSize >= bs.stackSize;
  bs.reset();
  expect(sufficient).toBe(true);
});
