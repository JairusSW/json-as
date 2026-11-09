// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { describe, expect } from "as-test";

let collections = 0;
function collectDuringInitialization(): i32 {
  __collect();
  return ++collections;
}


@json
class DestinationChild {
  pulse: i32 = collectDuringInitialization();
  name!: string;
  values!: f64[];
}


@json
class DestinationRoot {
  children!: (DestinationChild | null)[];
  names!: (string | null)[];
  numbers!: i64[][];
  raws!: JSON.Raw[];
}

describe("Array destinations stay rooted while children initialize and buffers grow", () => {
  expect(JSON.__cursorSupports<DestinationRoot>()).toBe(true);
  let children = "[";
  for (let i = 0; i < 40; i++) {
    if (i) children += ",";
    children +=
      i % 5 == 0
        ? "null"
        : '{"name":"child' + i.toString() + '","values":[1.25,-0]}';
  }
  children += "]";
  const input =
    '{"children":' +
    children +
    ',"names":["a",null,"b\\nc"],"numbers":[[1,2,3],[],[4]],"raws":[{"x":[1,2]},[true,null]]}';
  const before = collections;
  const first = JSON.parse<DestinationRoot>(input);
  const second = JSON.parse<DestinationRoot>(input);
  __collect();
  expect(collections - before).toBe(64);
  expect(first.children.length).toBe(40);
  for (let i = 0; i < 40; i++) {
    if (i % 5 == 0) {
      expect(first.children[i] === null).toBe(true);
    } else {
      expect(first.children[i]!.name).toBe("child" + i.toString());
      expect(first.children[i]!.values[0]).toBe(1.25);
      expect(reinterpret<u64>(first.children[i]!.values[1])).toBe(
        0x8000000000000000,
      );
    }
  }
  expect(first.names[1] === null).toBe(true);
  expect(first.names[2]).toBe("b\nc");
  expect(first.numbers[0][2]).toBe(3);
  expect(first.numbers[1].length).toBe(0);
  expect(first.raws[0].data).toBe('{"x":[1,2]}');
  expect(first.raws[1].data).toBe("[true,null]");
  first.children[1]!.name = "changed";
  first.names[0] = "changed";
  expect(second.children[1]!.name).toBe("child1");
  expect(second.names[0]).toBe("a");
  first.children.push(null);
  first.numbers[0].push(9);
  __collect();
  expect(first.children.length).toBe(41);
  expect(second.children.length).toBe(40);
  expect(first.numbers[0][3]).toBe(9);
  expect(second.numbers[0].length).toBe(3);
});
