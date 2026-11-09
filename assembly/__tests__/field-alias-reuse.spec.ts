// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class AliasedFields {
  left: string = "";
  right: string = "";
}

describe("object parsing separates aliased string destinations", () => {
  const output = new AliasedFields();
  const shared = "x".repeat(5);
  output.left = shared;
  output.right = shared;
  JSON.parse<AliasedFields>('{"left":"first","right":"other"}', output);
  expect(output.left).toBe("first");
  expect(output.right).toBe("other");
});

describe("escaped fields and duplicate keys remain independent during reuse", () => {
  const output = new AliasedFields();
  output.left = "x".repeat(5);
  output.right = output.left;
  JSON.parse<AliasedFields>(
    '{"left":"ab\\\"cd","right":"other","left":"final"}',
    output,
  );
  expect(output.left).toBe("final");
  expect(output.right).toBe("other");
});

describe("string array reuse separates aliased element buffers", () => {
  const shared = "x".repeat(5);
  const output = [shared, shared];
  JSON.parse<string[]>('["first","other"]', output);
  expect(output[0]).toBe("first");
  expect(output[1]).toBe("other");
});
