// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class ReusedDocument {
  count: i32 = 0;
  text: string = "";
  tail: JSON.Raw = JSON.Raw.from("null");
}

let calls = 0;


@json
class CustomDocument {

  @deserializer("object")
  read(data: string): CustomDocument {
    calls++;
    // Nested validation must not retain the outer discard stack's state.
    assert(JSON.validate('{"nested":[1,true,null]}'));
    return new CustomDocument();
  }
}

const reused = new ReusedDocument();
let input = "";
function rejectBoth(source: string): void {
  input = source;
  reused.count = 91;
  reused.text = "preserved";
  const before = calls;
  expect((): void => {
    JSON.parse<ReusedDocument>(input, reused);
  }).toThrow();
  expect(reused.count).toBe(91);
  expect(reused.text).toBe("preserved");
  expect((): void => {
    JSON.parse<CustomDocument>(input);
  }).toThrow();
  expect(calls).toBe(before);
}

function nested(depth: i32): string {
  let value = "0";
  for (let i = 1; i < depth; i++) value = "[" + value + "]";
  return '{"tail":' + value + "}";
}

describe("Strict fallback rejects malformed tails before mutation or codecs", () => {
  const invalid: string[] = [
    "",
    " ",
    "{",
    '{"count":1,}',
    '{"count":1 "text":"x"}',
    '{"count":1,"tail":[1,]}',
    '{"count":1,"tail":{"x":}}',
    '{"count":1,"tail":{"x" 1}}',
    '{"count":1,"tail":01}',
    '{"count":1,"tail":1.}',
    '{"count":1,"tail":1e+}',
    '{"count":1,"tail":NaN}',
    '{"count":1,"tail":truefalse}',
    '{"count":1,"tail":"\\q"}',
    '{"count":1,"tail":"\\u0xyz"}',
    '{"count":1,"tail":"raw\u0001"}',
    '{"count":1,"tail":[1}}',
    '{"count":1} false',
    '{"count":1}\u00a0',
  ];
  for (let i = 0; i < invalid.length; i++) rejectBoth(invalid[i]);
  expect(JSON.parse<ReusedDocument>('{"count":7}', reused).count).toBe(7);
});

describe("Strict fallback accepts depth boundary then recovers from excessive depth", () => {
  for (let depth = 255; depth <= 256; depth++) {
    input = nested(depth);
    expect(JSON.validate(input)).toBe(true);
    expect((): void => {
      JSON.parse<ReusedDocument>(input, reused);
    }).not.toThrow();
    const before = calls;
    expect((): void => {
      JSON.parse<CustomDocument>(input);
    }).not.toThrow();
    expect(calls > before).toBe(true);
  }
  rejectBoth(nested(257));
  input = nested(256);
  expect((): void => {
    JSON.parse<CustomDocument>(input);
  }).not.toThrow();
  expect(
    JSON.parse<ReusedDocument>('{"count":8,"text":"ok"}', reused).text,
  ).toBe("ok");
});

describe("Strict fallback preserves escaped keys, duplicate order and trailing whitespace", () => {
  const source =
    ' \n {"count":1,"co\\u0075nt":2,"text":"a\\nb","tail":[-0,1e2,null,true,false]} \t\r\n';
  const result = JSON.parse<ReusedDocument>(source, reused);
  expect(result === reused).toBe(true);
  expect(result.count).toBe(2);
  expect(result.text).toBe("a\nb");
  const before = calls;
  JSON.parse<CustomDocument>(source);
  expect(calls > before).toBe(true);
});
