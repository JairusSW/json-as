// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class FreshCollections {
  count!: i32;
  names!: string[];
  values!: Map<string, i32>;
  flags!: Set<i32>;
}

let initializerCalls = 0;


@json
class ObservableDefaults {
  count: i32 = ++initializerCalls;
  names!: string[];
}

describe("Fresh checked collection defaults", () => {
  const type = changetype<FreshCollections>(0);
  if (JSON_STRICT) expect(isDefined(type.__INITIALIZE_CURSOR)).toBe(true);
  const empty = JSON.parse<FreshCollections>("{}");
  expect(empty.count).toBe(0);
  expect(empty.names.length).toBe(0);
  expect(empty.values.size).toBe(0);
  expect(empty.flags.size).toBe(0);
  const next = JSON.parse<FreshCollections>(
    '{"count":7,"names":["a"],"values":{"x":4},"flags":[2,3]}',
  );
  expect(next.count).toBe(7);
  expect(next.names[0]).toBe("a");
  expect(next.values.get("x")).toBe(4);
  expect(next.flags.has(3)).toBe(true);
  next.names.push("b");
  next.values.set("y", 9);
  next.flags.add(8);
  expect(empty.names.length).toBe(0);
  expect(empty.values.size).toBe(0);
  expect(empty.flags.size).toBe(0);
  const duplicate = JSON.parse<FreshCollections>(
    '{"names":["first"],"names":["last"]}',
  );
  expect(duplicate.names.length).toBe(1);
  expect(duplicate.names[0]).toBe("last");
  expect(duplicate.values.size).toBe(0);
  expect(duplicate.flags.size).toBe(0);
});

describe("Checked parsing preserves explicit initializer execution", () => {
  if (!JSON_STRICT) return;
  const type = changetype<ObservableDefaults>(0);
  expect(isDefined(type.__INITIALIZE_CURSOR)).toBe(false);
  initializerCalls = 0;
  const value = JSON.parse<ObservableDefaults>(
    '{"count":42,"names":["present"]}',
  );
  expect(initializerCalls).toBe(1);
  expect(value.count).toBe(42);
  expect(value.names[0]).toBe("present");
});

describe("Fresh collection graphs survive collection and remain independent", () => {
  const retained = new Array<FreshCollections>();
  for (let i = 0; i < 24; i++) {
    const value = JSON.parse<FreshCollections>(
      i & 1 ? "{}" : '{"names":["kept"],"values":{"x":7},"flags":[4]}',
    );
    retained.push(value);
    __collect();
  }
  for (let i = 0; i < retained.length; i++) {
    const value = retained[i];
    expect(value.names.length).toBe(i & 1 ? 0 : 1);
    expect(value.values.size).toBe(i & 1 ? 0 : 1);
    expect(value.flags.size).toBe(i & 1 ? 0 : 1);
    if (!(i & 1)) {
      expect(value.names[0]).toBe("kept");
      expect(value.values.get("x")).toBe(7);
      expect(value.flags.has(4)).toBe(true);
    }
  }
});

let collectingCalls = 0;
function collectingDefault(): string {
  collectingCalls++;
  __collect();
  return "kept";
}


@json
class CollectingChild {
  token: string = collectingDefault();
  label!: string;
}


@json
class CollectingParent {
  names!: string[];
  child!: CollectingChild;
  children!: FreshCollections[];
}

describe("Fresh payload reference slots are safe during child initialization", () => {
  if (!JSON_STRICT) return;
  collectingCalls = 0;
  const value = JSON.parse<CollectingParent>(
    '{"names":["parent"],"child":{"label":"child"},"children":[{"names":["nested"]}]}',
  );
  expect(collectingCalls).toBe(2);
  __collect();
  expect(value.names[0]).toBe("parent");
  expect(value.child.token).toBe("kept");
  expect(value.child.label).toBe("child");
  expect(value.children[0].names[0]).toBe("nested");
  expect(value.children[0].values.size).toBe(0);
  expect(value.children[0].flags.size).toBe(0);
});
