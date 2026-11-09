// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
import { POW_TEN_TABLE_32, POW_TEN_TABLE_64 } from "../globals/tables";
import { deserializeTypedArray_NAIVE, deserializeArrayBuffer_NAIVE } from "../deserialize/naive/typedarray";
import { deserializeDate } from "../deserialize/naive/date";

@json
class DynamicRecord {
  count: i32 = 0;
  rate: f32 = 0;
}

@json
class EscModel {
  str: string = "default";
}

@json
class TwoIntFields {
  b: i32 = 99;
  n: i32 = 42;
}

@json
class TwoFloatFields {
  b: f64 = 99.0;
  f: f64 = 42.0;
}

@json
class ChildRecord {
  id: i32 = 0;
  name: string = "";
}

@json
class ParentRecord {
  children: ChildRecord[] = [];
}

@json
class ContainerWithSet {
  items: Set<i32> = new Set<i32>();
}

@json
class ContainerWithStaticArray {
  items: StaticArray<i32> = new StaticArray<i32>(0);
}

describe("Fix 1: Dynamic number decoding in JSON.Obj and JSON.Arr", () => {
  const obj = JSON.parse<JSON.Obj>('{"count":30,"rate":1.5,"big":9007199254740991,"flag":1}');
  expect(obj.getAs<i32>("count")).toBe(30);
  expect(obj.getAs<u32>("count")).toBe(30);
  expect(obj.getAs<i64>("count")).toBe(30);
  expect(obj.getAs<f32>("rate")).toBe(<f32>1.5);
  expect(obj.getAs<f64>("rate")).toBe(1.5);
  expect(obj.getAs<i64>("big")).toBe(9007199254740991);
  expect(obj.getAs<bool>("flag")).toBe(true);

  const arr = JSON.parse<JSON.Arr>("[30, 1.5, 0]");
  expect(arr.getAs<i32>(0)).toBe(30);
  expect(arr.getAs<u32>(0)).toBe(30);
  expect(arr.getAs<f32>(1)).toBe(<f32>1.5);
  expect(arr.getAs<bool>(2)).toBe(false);
});

describe("Fix 2: Power-of-10 table index 2 is 100", () => {
  const pow2_32 = load<u32>(POW_TEN_TABLE_32 + (2 << 2));
  expect(pow2_32).toBe(100);

  const pow2_64 = load<u64>(POW_TEN_TABLE_64 + (2 << 3));
  expect(pow2_64).toBe(100);
});

describe("Fix 3: Trailing colon without integer value throws", () => {
  expect((): void => {
    JSON.parse<TwoIntFields>('{"b":1,"n":}');
  }).toThrow();
});

describe("Fix 4: Trailing colon without float value throws", () => {
  expect((): void => {
    JSON.parse<TwoFloatFields>('{"b":1.0,"f":}');
  }).toThrow();
});

describe("Fix 5: NAIVE deserializeEscapedStringField rejects invalid escape", () => {
  expect((): void => {
    JSON.parse<EscModel>('{"str":"hello\\zworld"}');
  }).toThrow();
});

describe("Fix 6: NAIVE deserializeTypedArray_NAIVE with leading whitespace", () => {
  const json = '  [10, 20, 30]';
  const ptr = changetype<usize>(json);
  const end = ptr + (<usize>json.length << 1);
  const arr = deserializeTypedArray_NAIVE<Int32Array>(ptr, end);
  expect(arr[0]).toBe(10);
  expect(arr[1]).toBe(20);
  expect(arr[2]).toBe(30);

  const buf = deserializeArrayBuffer_NAIVE(ptr, end);
  expect(load<u8>(changetype<usize>(buf))).toBe(10);
});

describe("Fix 7: deserializeDate with leading whitespace", () => {
  const json = '  "2020-01-01T00:00:00.000Z"';
  const ptr = changetype<usize>(json);
  const end = ptr + (<usize>json.length << 1);
  const d = deserializeDate(ptr, end);
  expect(d.getUTCFullYear()).toBe(2020);
});

describe("Fix 9: Grammar validator rejects missing value at delimiter", () => {
  expect((): void => {
    JSON.parse<TwoIntFields>('{"n":}');
  }).toThrow();
  expect((): void => {
    JSON.parse<TwoIntFields>('{"n":, "b":1}');
  }).toThrow();
});

describe("Fix 10: Array of structs rejects malformed element", () => {
  expect((): void => {
    JSON.parse<ParentRecord>('{"children":[{"id":, "name":"a"}]}');
  }).toThrow();
});

describe("Fix 15: Leading whitespace support across collection types", () => {
  const setDirect = JSON.parse<Set<i32>>("  [1, 2, 3]");
  expect(setDirect.size).toBe(3);

  const setObj = JSON.parse<ContainerWithSet>('{"items": [10, 20]}');
  expect(setObj.items.size).toBe(2);

  const mapDirect = JSON.parse<Map<string, i32>>('  {"x": 1, "y": 2}');
  expect(mapDirect.size).toBe(2);

  const staticArr = JSON.parse<ContainerWithStaticArray>('{"items": [5, 6, 7]}');
  expect(staticArr.items.length).toBe(3);

  const intArr = JSON.parse<i32[]>("  [100, 200]");
  expect(intArr.length).toBe(2);

  const strArr = JSON.parse<string[]>('  ["hello", "world"]');
  expect(strArr.length).toBe(2);

  const boolArr = JSON.parse<bool[]>("  [true, false]");
  expect(boolArr.length).toBe(2);
});

describe("Fix 17: u8[] array validation", () => {
  const u8Arr = JSON.parse<u8[]>("  [1, 2, 3]");
  expect(u8Arr.length).toBe(3);
  expect(u8Arr[0]).toBe(1);
  expect(u8Arr[1]).toBe(2);
  expect(u8Arr[2]).toBe(3);

  expect((): void => {
    JSON.parse<u8[]>("not array");
  }).toThrow();

  expect((): void => {
    JSON.parse<u8[]>("123");
  }).toThrow();

  expect((): void => {
    JSON.parse<u8[]>("[1 2]");
  }).toThrow();
});

describe("Fix 18: Float validation on malformed float tokens", () => {
  expect((): void => {
    JSON.parse<f64>("3.14abc");
  }).toThrow();

  expect((): void => {
    JSON.parse<f64>("123e");
  }).toThrow();
});

describe("Fix 19: String quote validation across backends", () => {
  expect((): void => {
    JSON.parse<string>("12345");
  }).toThrow();

  expect((): void => {
    JSON.parse<string>("unquoted");
  }).toThrow();

  expect((): void => {
    JSON.parse<string>('"missing-end-quote');
  }).toThrow();
});

describe("Fix 20: Boolean leading whitespace", () => {
  expect(JSON.parse<bool>("  true")).toBe(true);
  expect(JSON.parse<bool>("  false")).toBe(false);
});

describe("Fix 21: Date error propagation", () => {
  expect((): void => {
    JSON.parse<Date>("12345");
  }).toThrow();

  expect((): void => {
    JSON.parse<Date>("not-a-date");
  }).toThrow();
});

class ZeroReader {
  __INITIALIZE(): void {}
  __DESERIALIZE_SLOW<T>(_start: usize, _end: usize, _out: T): usize { return 0; }
}

describe("Zero-returning child readers propagate failure in arrays and Maps", () => {
  expect((): void => { JSON.parse<ZeroReader[]>("[{}]"); }).toThrow();
  expect((): void => { JSON.parse<Map<string, ZeroReader>>('{"x":{}}'); }).toThrow();
});

@json
class UnsignedRecord { a: u32 = 1; b: u32 = 2; }

describe("Empty signed and unsigned field tokens reject after a valid prefix", () => {
  expect((): void => { JSON.parse<UnsignedRecord>('{"a":1,"b":}'); }).toThrow();
  expect((): void => { JSON.parse<TwoIntFields>('{"b":1,"n":-}'); }).toThrow();
  expect((): void => { JSON.parse<TwoFloatFields>('{"b":1,"f":-}'); }).toThrow();
});

describe("Narrow integer kernels preserve values and reject missing delimiters", () => {
  const out: u8[] = [];
  const input = '[0,1,12,123,255,10,2]';
  expect(JSON.stringify(JSON.parse<u8[]>(input, out))).toBe(input);
  expect(JSON.stringify(JSON.parse<i8[]>('[-128,-1,0,127]'))).toBe('[-128,-1,0,127]');
  expect((): void => { JSON.parse<u8[]>('[1,]'); }).toThrow();
  expect((): void => { JSON.parse<i32[]>('[1,]'); }).toThrow();
  expect((): void => { JSON.parse<i8[]>('[-]'); }).toThrow();
  expect((): void => { JSON.parse<u8[]>('[1,,2]'); }).toThrow();
});

describe("Malformed escaped Map keys reach the public error boundary", () => {
  expect((): void => { JSON.parse<Map<string, i32>>('{"\\z":1}'); }).toThrow();
  expect((): void => { JSON.parse<Map<i32, i32>>('{"\\z":1}'); }).toThrow();
});

describe("Packed narrow-array kernels validate complete UTF16 digit lanes", () => {
  expect((): void => { JSON.parse<u8[]>('[12x,123,4]'); }).toThrow();
  expect((): void => { JSON.parse<u8[]>('[1a,123,4]'); }).toThrow();
  expect((): void => { JSON.parse<u8[]>('[\u0131\u0132,123,4]'); }).toThrow();
});
