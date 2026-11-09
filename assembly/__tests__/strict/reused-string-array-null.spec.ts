// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { describe, expect } from "as-test";

let destination: string[] = ["old"];
describe("strict reused nonnullable string arrays reject null", () => {
  expect((): void => {
    JSON.parse<string[]>("[null]", destination);
  }).toThrow();
});

describe("strict nullable string arrays still accept null", () => {
  const out: (string | null)[] = ["old"];
  const value = JSON.parse<(string | null)[]>('[null,"ok"]', out);
  expect(value[0] === null).toBe(true);
  expect(value[1]).toBe("ok");
});


@json
class StringArrays {
  required: string[] = [];
  optional: (string | null)[] = [];
}
let objectDestination = new StringArrays();
describe("strict nonnullable string fields reject null arrays during reuse", () => {
  expect((): void => {
    JSON.parse<StringArrays>('{"required":[null]}', objectDestination);
  }).toThrow();
  const valid = JSON.parse<StringArrays>(
    '{"required":["ok"],"optional":[null,"text"]}',
    objectDestination,
  );
  expect(valid.required[0]).toBe("ok");
  expect(valid.optional[0] === null).toBe(true);
  expect(valid.optional[1]).toBe("text");
});

describe("nullable static string arrays retain nullable elements", () => {
  const result = JSON.parse<StaticArray<string | null>>('["a",null,"b"]');
  expect(result[0]).toBe("a");
  expect(result[1] === null).toBe(true);
  expect(result[2]).toBe("b");
});
