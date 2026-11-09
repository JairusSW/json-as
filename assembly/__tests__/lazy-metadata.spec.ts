// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";


@json class LazyAlias {

  @alias("wire_name") name: JSON.Lazy<string> = "default";
}


@json class LazyOmit {

  @omit secret: JSON.Lazy<string> = "hidden";
  visible: i32 = 7;
}


@json class LazyBase {
  text: JSON.Lazy<string> = "base";
}


@json class LazyChild extends LazyBase {
  count: i32 = 7;
}


@json class LazyOuter {
  label: JSON.Lazy<string> = "initial";
  child: LaterChild = new LaterChild();
}


@json class LaterChild {
  count: i32 = 7;
}
describe("lazy aliases and omitted fields retain wire metadata", () => {
  expect(JSON.stringify(new LazyAlias())).toBe('{"wire_name":"default"}');
  expect(JSON.parse<LazyAlias>('{"wire_name":"updated"}').name).toBe("updated");
  expect(JSON.stringify(new LazyOmit())).toBe('{"visible":7}');
});
describe("lazy inheritance and dependency order retain slots", () => {
  expect(JSON.stringify(new LazyChild())).toBe('{"text":"base","count":7}');
  expect(JSON.stringify(new LazyOuter())).toBe(
    '{"label":"initial","child":{"count":7}}',
  );
});


@json class MoreLazy extends LazyBase {
  own: JSON.Lazy<string> = "own";
}
describe("inherited lazy fields share the parsed source anchor", () => {
  const value = JSON.parse<MoreLazy>(
    '{"text":"base parsed","own":"child parsed"}',
  );
  expect(value.text).toBe("base parsed");
  expect(value.own).toBe("child parsed");
  expect(JSON.stringify(value)).toBe(
    '{"text":"base parsed","own":"child parsed"}',
  );
  expect(
    JSON.parse<LazyOuter>('{"label":"changed","child":{"count":9}}').label,
  ).toBe("changed");
});
