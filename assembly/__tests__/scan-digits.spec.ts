// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { describe, expect } from "as-test";
import { JSON } from "..";
import { scanDigits } from "../util/scanDigits";

const BLOCK = memory.data(24);

describe("Word digit scan checks every UTF-16 code unit in each lane", () => {
  let mismatches = 0;
  // Exercise every 16-bit value, every lane, and all UTF-16 alignments of u64.
  for (let offset: usize = 0; offset < 8; offset += 2) {
    const ptr = BLOCK + offset;
    for (let lane: usize = 0; lane < 4; lane++) {
      store<u64>(ptr, 0x0031_0031_0031_0031);
      for (let code: u32 = 0; code <= 0xffff; code++) {
        store<u16>(ptr + (lane << 1), <u16>code);
        const expected = code >= 48 && code <= 57 ? ptr + 8 : ptr + (lane << 1);
        if (scanDigits(ptr, ptr + 8) != expected) mismatches++;
      }
    }
  }
  expect(mismatches).toBe(0);
});

describe("Word digit scan respects bounded tails", () => {
  store<u64>(BLOCK, 0x0039_0030_0031_0038);
  store<u64>(BLOCK, 0x0130_0031_0032_0033, 8);
  for (let units: usize = 0; units < 8; units++) {
    expect(scanDigits(BLOCK, BLOCK + (units << 1))).toBe(BLOCK + (units << 1));
  }
  expect(scanDigits(BLOCK, BLOCK + 16)).toBe(BLOCK + 14);
  store<u64>(BLOCK, 0x0030_0000_002f_0030);
  expect(scanDigits(BLOCK, BLOCK + 8)).toBe(BLOCK + 2);
});

describe("Checked number grammar preserves block boundaries and delimiters", () => {
  const valid = [
    "0",
    "1234",
    "-123456789",
    "0.1234567890123456789",
    "1234.5678e+9012",
    "1e-123456789012345678901234567890",
    "0.0000",
  ];
  const invalid = [
    "0000",
    "012345",
    "1234.",
    "1.1234e+",
    "1e1.2",
    "1234x",
    "1.1234e4567x",
    "123\u0130",
    "12\u0030\u0000",
    "-",
    "1e",
  ];
  for (let i = 0; i < valid.length; i++) {
    const value = valid[i];
    expect(JSON.validate(value)).toBe(true);
    expect(JSON.validate("[" + value + "," + value + "]")).toBe(true);
    expect(JSON.validate('{"key":' + value + "}")).toBe(true);
  }
  for (let i = 0; i < invalid.length; i++) {
    expect(JSON.validate(invalid[i])).toBe(false);
    expect(JSON.validate("[" + invalid[i] + "]")).toBe(false);
  }
});

describe("Checked integer runs preserve grammar at every word tail", () => {
  let digits = "1";
  const keys = ["a", "ab", "abc"];
  for (let length = 1; length <= 32; length++) {
    expect(JSON.validate(digits)).toBe(true);
    expect(JSON.validate("-" + digits)).toBe(true);
    expect(JSON.validate("[" + digits + ",0]")).toBe(true);
    for (let i = 0; i < keys.length; i++) {
      expect(JSON.validate('{"' + keys[i] + '":' + digits + "}")).toBe(true);
    }
    expect(JSON.validate("0" + digits)).toBe(false);
    expect(JSON.validate("-0" + digits)).toBe(false);
    expect(JSON.validate(digits + ".")).toBe(false);
    expect(JSON.validate(digits + "e+")).toBe(false);
    expect(JSON.validate(digits + "e-0")).toBe(true);
    expect(JSON.validate(digits + "\u0130")).toBe(false);
    digits += (length % 10).toString();
  }
});
