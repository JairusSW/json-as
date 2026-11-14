// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";


@json
class Item {
  n: i32 = 0;
  s: string = "";
}


@json
class Base {
  value: JSON.Lazy<i32> = 1;
  text: JSON.Lazy<string> = "base";
}


@json
class Child extends Base {
  value: JSON.Lazy<i32> = 2;
  text: JSON.Lazy<string> = "child";
  tail: i32 = 3;
}


@json
class Aliased extends Base {

  @alias("changed") value: JSON.Lazy<i32> = 2;
}


@json
class Views {
  a: Uint8Array = new Uint8Array(2);
  b: Uint8Array = Uint8Array.wrap(this.a.buffer);
}


@json
class BufferAndView {
  bytes: ArrayBuffer = new ArrayBuffer(2);
  view: Uint8Array = Uint8Array.wrap(this.bytes);
}
export function incompatible(reuse: bool): i32 {
  return JSON.parse<Item>(
    '{"n":{},"s":""}',
    reuse ? new Item() : changetype<Item>(0),
  ).n;
}
export function unknown(reuse: bool): i32 {
  return JSON.parse<Item>(
    '{"n":7,"s":"","extra":{}}',
    reuse ? new Item() : changetype<Item>(0),
  ).n;
}
export function valid(reuse: bool): i32 {
  return JSON.parse<Item>(
    '{"n":7,"s":"ok"}',
    reuse ? new Item() : changetype<Item>(0),
  ).n;
}
export function numeric(kind: i32): bool {
  const v =
    kind == 0
      ? JSON.Value.from<i32>(256)
      : kind == 1
        ? JSON.Value.from<i64>(65536)
        : kind == 2
          ? JSON.Value.from<u64>(4294967296)
          : kind == 3
            ? JSON.Value.from<f64>(0.5)
            : kind == 4
              ? JSON.Value.from<i32>(0)
              : JSON.Value.from<i32>(-256);
  return (
    v.get<bool>() == (kind != 4) &&
    JSON.Box.fromValue<bool>(v)!.value == (kind != 4) &&
    v.asBox<bool>()!.value == (kind != 4)
  );
}
export function lazy(parse: bool): string {
  const out = parse
    ? JSON.parse<Child>('{"value":7,"text":"changed","tail":3}')
    : new Child();
  assert(out.value == (parse ? 7 : 2));
  assert(out.text == (parse ? "changed" : "child"));
  return JSON.stringify(out);
}
export function aliasOverride(): string {
  return JSON.stringify(JSON.parse<Aliased>('{"changed":7,"text":"base"}'));
}
export function views(reuse: bool): string {
  return JSON.stringify(
    JSON.parse<Views>(
      '{"a":[1,2],"b":[3,4]}',
      reuse ? new Views() : changetype<Views>(0),
    ),
  );
}
export function buffer(reuse: bool): string {
  return JSON.stringify(
    JSON.parse<BufferAndView>(
      '{"bytes":[1,2],"view":[3,4]}',
      reuse ? new BufferAndView() : changetype<BufferAndView>(0),
    ),
  );
}


@json
class ReversedBuffer {
  view: Uint8Array = new Uint8Array(4);
  bytes: ArrayBuffer = this.view.buffer;
}


@json
class OffsetViews {
  a: Uint8Array = new Uint8Array(4);
  b: Uint8Array = Uint8Array.wrap(this.a.buffer, 1, 2);
}
class Middle extends Base {}


@json
class Leaf extends Middle {
  value: JSON.Lazy<i32> = 4;
}
export function ancestorOverride(): string {
  return JSON.stringify(JSON.parse<Leaf>('{"value":7,"text":"base"}'));
}
export function reversed(reuse: bool): string {
  return JSON.stringify(
    JSON.parse<ReversedBuffer>(
      '{"view":[1,2,3,4],"bytes":[5,6,7,8]}',
      reuse ? new ReversedBuffer() : changetype<ReversedBuffer>(0),
    ),
  );
}
export function overlap(reuse: bool): string {
  return JSON.stringify(
    JSON.parse<OffsetViews>(
      '{"a":[1,2,3,4],"b":[5,6]}',
      reuse ? new OffsetViews() : changetype<OffsetViews>(0),
    ),
  );
}
export function standalone(): bool {
  const out = new Uint8Array(2);
  return (
    JSON.parse<Uint8Array>("[1,2]", out) === out && out[0] == 1 && out[1] == 2
  );
}
