// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

/* eslint-disable @typescript-eslint/no-wrapper-object-types -- AssemblyScript Object provides managed GC roots and runtime ancestry checks. */

import { JSON } from "..";

let reads: i32 = 0;
let writes: i32 = 0;
let checks: i32 = 0;
let failures: string = "";
const roots: Object[] = [];

// Minimal GC does not scan local stack references. Retain every value that
// the caller will use after collection through an explicit global root.
function collect<T>(out: T, small: string = "", big: string = ""): void {
  roots.length = 0;
  roots.push(changetype<Object>(out));
  roots.push(changetype<Object>(small));
  roots.push(changetype<Object>(big));
  __collect();
  roots.length = 0;
}

class HiddenLength<T> extends Array<T> {
  get length(): i32 {
    reads++;
    return 0;
  }
  set length(_value: i32) {
    writes++;
  }
}

class Seeded extends HiddenLength<i32> {
  marker: i32 = 7;
  constructor() {
    super();
    super.push(99);
  }
}


@json
class Row {
  n: i32 = 0;
  text: string = "";
}


@json
class Fields {
  ints!: HiddenLength<i32>;
  floats!: HiddenLength<f64>;
  bools!: HiddenLength<bool>;
  text!: HiddenLength<string>;
  rows!: HiddenLength<Row>;
  nested!: HiddenLength<HiddenLength<i32>>;
  dynamic!: HiddenLength<JSON.Value>;
}

function check(actual: string, expected: string, label: string): void {
  checks++;
  if (actual != expected)
    failures += label + ": " + actual + " != " + expected + "\n";
}
function text(token: string, count: i32): string {
  return count ? "[" + token + ("," + token).repeat(count - 1) + "]" : "[]";
}

function routes<T>(token: string, label: string): void {
  reads = 0;
  writes = 0;
  const small = text(token, 3);
  const big = text(token, 65);
  let out = JSON.parse<T>(small);
  check(JSON.stringify(out), small, label + "/fresh");
  out = JSON.parse<T>(big, out);
  check(JSON.stringify(out), big, label + "/growth");
  out = JSON.parse<T>(text(token, 1), out);
  collect(out, small, big);
  check(JSON.stringify(out), text(token, 1), label + "/shrink-GC");
  out = JSON.parse<T>(big, out);
  collect(out, small, big);
  check(JSON.stringify(out), big, label + "/regrow-GC");
  out = JSON.parse<T>("[]", out);
  check(JSON.stringify(out), "[]", label + "/empty");
  out = JSON.parse<T>(small, out);
  check(JSON.stringify(out), small, label + "/refill");
  check(reads.toString(), "0", label + "/getter");
  check(writes.toString(), "0", label + "/setter");
}

export function run(): string {
  return JSON.stringify(JSON.parse<HiddenLength<i32>>("[1,2,3]"));
}
export function count(): i32 {
  return checks;
}
export function matrix(): string {
  failures = "";
  checks = 0;
  routes<HiddenLength<i8>>("123", "i8");
  routes<HiddenLength<u8>>("255", "u8");
  routes<HiddenLength<i16>>("-1234", "i16");
  routes<HiddenLength<u16>>("65535", "u16");
  routes<HiddenLength<i32>>("-123456", "i32");
  routes<HiddenLength<u32>>("4294967295", "u32");
  routes<HiddenLength<i64>>("-9007199254740993", "i64");
  routes<HiddenLength<u64>>("9007199254740993", "u64");
  routes<HiddenLength<f32>>("1.5", "f32");
  routes<HiddenLength<f64>>("2.5", "f64");
  routes<HiddenLength<bool>>("true", "bool");
  routes<HiddenLength<string>>('"managed text"', "string");
  routes<HiddenLength<Row>>('{"n":7,"text":"managed row"}', "struct");
  routes<HiddenLength<HiddenLength<i32>>>("[1,2,3]", "nested");
  routes<HiddenLength<JSON.Value>>('{"n":7}', "value");
  routes<HiddenLength<Map<string, i32>>>('{"n":7}', "map");
  routes<HiddenLength<Set<i32>>>("[1,2,3]", "set");
  routes<Array<i32>>("7", "base-control");
  routes<Array<Row>>('{"n":7,"text":"base row"}', "base-struct-control");
  routes<HiddenLength<Map<string, Row>>>(
    '{"n":{"n":7,"text":"map row"}}',
    "map-struct",
  );

  reads = 0;
  writes = 0;
  const seeded = JSON.parse<Seeded>("[1,2,3]");
  check(JSON.stringify(seeded), "[1,2,3]", "seeded");
  check(seeded.marker.toString(), "7", "constructor");
  const object: Object = seeded;
  check((object instanceof Seeded).toString(), "true", "identity");
  check(reads.toString(), "0", "seeded/getter");
  check(writes.toString(), "0", "seeded/setter");

  const json =
    '{"ints":[1,2,3],"floats":[1.5,2.5],"bools":[true,false],"text":["one","two"],"rows":[{"n":7,"text":"field"}],"nested":[[1,2],[3]],"dynamic":[{"n":7},true]}';
  reads = 0;
  writes = 0;
  let fields = JSON.parse<Fields>(json);
  check(JSON.stringify(fields), json, "fields/fresh");
  fields = JSON.parse<Fields>(json, fields);
  collect(fields);
  check(JSON.stringify(fields), json, "fields/reused-GC");
  check(reads.toString(), "0", "fields/getter");
  check(writes.toString(), "0", "fields/setter");

  const staticInput = "[[1,2,3],[4,5]]";
  const staticOut = JSON.parse<StaticArray<HiddenLength<i32>>>(staticInput);
  check(JSON.stringify(staticOut), staticInput, "static-container");
  const structs = '[{"n":7,"text":"static"}]';
  check(
    JSON.stringify(JSON.parse<StaticArray<Row>>(structs)),
    structs,
    "static-struct-control",
  );

  reads = 0;
  writes = 0;
  const baseView: Array<i32> = new HiddenLength<i32>();
  check(
    JSON.stringify(JSON.parse<Array<i32>>("[1,2,3]", baseView)),
    "[1,2,3]",
    "upcast-destination",
  );
  check(reads.toString(), "0", "upcast/getter");
  check(writes.toString(), "0", "upcast/setter");

  reads = 0;
  writes = 0;
  const app = new HiddenLength<i32>();
  app.length = 10;
  check(app.length.toString(), "0", "application-getter");
  check(reads.toString(), "1", "application/getter-count");
  check(writes.toString(), "1", "application/setter-count");
  return failures;
}
