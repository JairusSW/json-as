// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class DispatchBase {
  constructor(public value: i32 = 0) {}
}


@json
class DispatchChild extends DispatchBase {
  label: string;

  constructor(value: i32 = 0, label: string = "child") {
    super(value);
    this.label = label;
  }
}


@json
class DispatchCustom extends DispatchBase {
  constructor(value: i32 = 0) {
    super(value);
  }


  @serializer("string")
  encode(self: DispatchCustom): string {
    return JSON.stringify("custom-" + self.value.toString());
  }
}

describe("Shared writers preserve subclass dispatch through parent references", () => {
  const child = new DispatchChild(2);
  const custom = new DispatchCustom(3);
  const values: DispatchBase[] = [new DispatchBase(1), child, custom];
  expect(JSON.stringify(values)).toBe(
    '[{"value":1},' + JSON.stringify<DispatchChild>(child) + ',"custom-3"]',
  );
  const nullable: (DispatchBase | null)[] = [null, custom, child];
  expect(JSON.stringify(nullable)).toBe(
    '[null,"custom-3",' + JSON.stringify<DispatchChild>(child) + "]",
  );
  expect(JSON.stringify<DispatchBase>(custom)).toBe('"custom-3"');
  const map = new Map<string, DispatchBase>();
  map.set("custom", custom);
  map.set("child", child);
  expect(JSON.stringify(map)).toBe(
    '{"custom":"custom-3","child":' +
      JSON.stringify<DispatchChild>(child) +
      "}",
  );
});
