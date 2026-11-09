// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";

let seen = "";
let shrink = true;
function visitReverse(value: JSON.Value, index: i32, array: JSON.Arr): bool {
  seen += index.toString() + ":" + value.get<f64>().toString() + ",";
  if (index == 3) {
    if (shrink) array.length = 1;
    else array.clear();
  }
  return false;
}
function reduceReverse(
  acc: i32,
  value: JSON.Value,
  index: i32,
  array: JSON.Arr,
): i32 {
  visitReverse(value, index, array);
  return acc + <i32>value.get<f64>();
}

describe("Review: reverse callbacks obey the live range after mutation", () => {
  for (let operation = 0; operation < 3; operation++) {
    for (let clear = 0; clear < 2; clear++) {
      shrink = clear == 0;
      seen = "";
      const array = JSON.parse<JSON.Arr>("[1,2,3,4]");
      if (operation == 0)
        expect(array.findLast(visitReverse) === null).toBe(true);
      else if (operation == 1)
        expect(array.findLastIndex(visitReverse)).toBe(-1);
      else
        expect(array.reduceRight<i32>(reduceReverse, 0)).toBe(shrink ? 5 : 4);
      expect(seen).toBe(shrink ? "3:4.0,0:1.0," : "3:4.0,");
    }
  }
});
