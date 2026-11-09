// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { JSON as J } from "..";
import * as lib from "..";
import { PublicLazy } from "./composition-marker.fixture";
import { describe, expect } from "as-test";


@json class MarkerBindings {
  named: J.Lazy<string> = "seed";
  wildcard: lib.JSON.Lazy<string> = "seed";
  alias: PublicLazy<string> = "seed";
}
namespace Foreign {

  @json export class Lazy<T> {
    value: T;
    constructor(value: T) {
      this.value = value;
    }
  }
}


@json class ForeignOwner {
  inner: Foreign.Lazy<i32> = new Foreign.Lazy<i32>(7);
}
describe("lazy markers resolve declarations through import bindings", () => {
  const value = JSON.parse<MarkerBindings>(
    '{"named":"a","wildcard":"b","alias":"c"}',
  );
  expect(value.named).toBe("a");
  expect(value.wildcard).toBe("b");
  expect(value.alias).toBe("c");
  expect(JSON.stringify(value)).toBe(
    '{"named":"a","wildcard":"b","alias":"c"}',
  );
  expect(JSON.stringify(new ForeignOwner())).toBe('{"inner":{"value":7}}');
});
