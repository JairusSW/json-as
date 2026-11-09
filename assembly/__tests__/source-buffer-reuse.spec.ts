// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class SourceBufferRecord {
  value: string = "";
}

describe("parse observes overwritten owned JSON source buffers", () => {
  const input = new SourceBufferRecord();
  input.value = "first";
  let source = JSON.stringify(input);
  const output = new SourceBufferRecord();
  JSON.parse<SourceBufferRecord>(source, output);
  JSON.parse<SourceBufferRecord>(source, output);
  expect(output.value).toBe("first");
  const pointer = changetype<usize>(source);
  input.value = "other";
  source = JSON.stringify(input, source);
  expect(changetype<usize>(source)).toBe(pointer);
  expect(source).toBe('{"value":"other"}');
  JSON.parse<SourceBufferRecord>(source, output);
  expect(output.value).toBe("other");
});

describe("parse restores cached fields overwritten through owned output reuse", () => {
  const source = '{"value":"first"}';
  const output = new SourceBufferRecord();
  JSON.parse<SourceBufferRecord>(source, output);
  JSON.parse<SourceBufferRecord>(source, output);
  const pointer = changetype<usize>(output.value);
  output.value = JSON.stringify<string>("abc", output.value);
  expect(changetype<usize>(output.value)).toBe(pointer);
  expect(output.value).toBe('"abc"');
  JSON.parse<SourceBufferRecord>(source, output);
  expect(output.value).toBe("first");
});
