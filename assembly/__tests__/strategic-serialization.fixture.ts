// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON, JSON as J } from "../index";
import * as Library from "../index";

let decodes: i32 = 0;
let encodes: i32 = 0;

@json
class Payload {
  n: i32 = 0;
  @deserializer("number") decode(data: string): Payload {
    decodes++;
    const out = new Payload();
    out.n = <i32>parseFloat(data);
    return out;
  }
  @serializer("number") encode(self: Payload): string {
    encodes++;
    return (self.n + 100).toString();
  }
}

@json({ lazy: "strategic" })
class Wire {
  needed: i32 = 0;
  data!: Payload;
  label: string = "";
}

function mask(value: Wire): i32 {
  return i32(load<u64>(changetype<usize>(value), offsetof<Wire>("__needed_lz")) >>> 32 == 0xffffffff);
}

const input = '{"needed":7,"data":9e0,"label":"\\u0061"}';

export function readThenForward(): string {
  decodes = encodes = 0;
  const value = JSON.parse<Wire>(input);
  const before = mask(value);
  const n = value.needed;
  const text = JSON.stringify(value);
  return before.toString() + ":" + n.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString();
}

export function aliasForward(): string {
  decodes = encodes = 0;
  const value = J.parse<Wire>(input);
  const before = mask(value);
  const n = value.needed;
  const text = J.stringify(value);
  return before.toString() + ":" + n.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString();
}

export function namespaceForward(): string {
  decodes = encodes = 0;
  const value = JSON.parse<Wire>(input);
  const before = mask(value);
  const n = value.needed;
  const text = Library.JSON.stringify(value);
  return before.toString() + ":" + n.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString();
}

function forward(value: Wire): string { return JSON.stringify(value); }

export function helperForward(): string {
  decodes = encodes = 0;
  const value = JSON.parse<Wire>(input);
  const before = mask(value);
  const n = value.needed;
  const text = forward(value);
  return before.toString() + ":" + n.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString();
}

export function replaceFields(): string {
  decodes = encodes = 0;
  const value = JSON.parse<Wire>(input);
  value.needed = 11;
  const next = new Payload();
  next.n = 42;
  value.data = next;
  value.label = "changed";
  const text = JSON.stringify(value);
  return text + "|" + decodes.toString() + ":" + encodes.toString();
}

export function mutateChild(): string {
  decodes = encodes = 0;
  const value = JSON.parse<Wire>(input);
  const before = mask(value);
  const n = value.needed;
  const child = value.data;
  child.n = 12;
  const text = JSON.stringify(value);
  return before.toString() + ":" + n.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString();
}

export function readAfterForward(): string {
  decodes = encodes = 0;
  const value = JSON.parse<Wire>(input);
  const before = mask(value);
  const n = value.needed;
  const first = JSON.stringify(value);
  const child = value.data;
  child.n = 12;
  const second = JSON.stringify(value);
  return before.toString() + ":" + n.toString() + "|" + first + "|" + second + "|" + decodes.toString() + ":" + encodes.toString();
}

export function fullRead(): string {
  decodes = encodes = 0;
  const value = JSON.parse<Wire>(input);
  const before = mask(value);
  const sum = value.needed + value.data.n + value.label.length;
  const text = JSON.stringify(value);
  return before.toString() + ":" + sum.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString();
}

function collectWithRoot<T>(value: T): void {
  __pin(changetype<usize>(value));
  __collect();
  __unpin(changetype<usize>(value));
}

export function gcForward(n: i32): string {
  decodes = encodes = 0;
  let source = '{"needed":7,"data":' + n.toString() + 'e0,"label":"\\u0061"}';
  const value = JSON.parse<Wire>(source);
  source = "";
  collectWithRoot(value);
  const before = mask(value);
  const needed = value.needed;
  const text = JSON.stringify(value);
  return before.toString() + ":" + needed.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString();
}

export function reuseForward(): string {
  decodes = encodes = 0;
  const out = JSON.parse<Wire>(input);
  const value = JSON.parse<Wire>('{"label":"\\u0062","data":12e0,"needed":8}', out);
  const before = mask(value);
  const needed = value.needed;
  const text = JSON.stringify(value, "false");
  return before.toString() + ":" + needed.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString() + "|false";
}

class LocalForwarder {
  stringify(value: Wire): string { return J.stringify(value); }
}

export function localForwarder(): string {
  decodes = encodes = 0;
  const JSON = new LocalForwarder();
  const value = J.parse<Wire>(input);
  const before = mask(value);
  const n = value.needed;
  const text = JSON.stringify(value);
  return before.toString() + ":" + n.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString();
}

export function hoistedForwarder(): string {
  decodes = encodes = 0;
  {
    // eslint-disable-next-line no-var
    var JSON = new LocalForwarder();
  }
  const value = J.parse<Wire>(input);
  const before = mask(value);
  const n = value.needed;
  const text = JSON.stringify(value);
  return before.toString() + ":" + n.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString();
}

@json
class Ordinary {
  needed: i32 = 0;
  data!: Payload;
  label: string = "";
}

@json({ nolazy })
class Eager extends Ordinary {}

export function ordinaryForward(): string {
  decodes = encodes = 0;
  const value = JSON.parse<Ordinary>(input);
  const text = JSON.stringify(value);
  return text + "|" + decodes.toString() + ":" + encodes.toString();
}

export function eagerForward(): string {
  decodes = encodes = 0;
  const value = JSON.parse<Eager>(input);
  const text = JSON.stringify(value);
  return text + "|" + decodes.toString() + ":" + encodes.toString();
}

@json
class OrdinaryScalars {
  needed: i32 = 0;
  untouched: string = "";
}
export function ordinaryScalarForward(): string {
  const value = JSON.parse<OrdinaryScalars>('{"needed":7,"untouched":"\\u006bept"}');
  const n = value.needed;
  return n.toString() + "|" + JSON.stringify(value);
}

@json({ lazy: "strategic" })
class ArrayWire {
  needed: i32 = 0;
  items!: Payload[];
}

export function eagerArrayForward(): string {
  decodes = encodes = 0;
  const value = JSON.parse<ArrayWire>('{"needed":7,"items":[9]}');
  const n = value.needed;
  const text = JSON.stringify(value);
  return n.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString();
}

@json({ lazy: "strategic" })
class ParentWire {
  @alias("required_id") needed: i32 = 0;
  data!: Payload;
}
class MiddleWire extends ParentWire {}
@json({ lazy: "strategic" })
class ChildWire extends MiddleWire {
  label: string = "";
}
function inheritedMask(value: ChildWire): i32 {
  return i32(load<u64>(changetype<usize>(value), offsetof<ParentWire>("__needed_lz")) >>> 32 == 0xffffffff);
}
export function inheritedForward(): string {
  decodes = encodes = 0;
  const value = JSON.parse<ChildWire>('{"required_id":7,"data":9e0,"label":"\\u0061"}');
  const before = inheritedMask(value);
  const n = value.needed;
  const text = JSON.stringify(value);
  return before.toString() + ":" + n.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString();
}

@json({ lazy: "strategic" })
class OmittedWire {
  needed: i32 = 0;
  @omitnull optional: string | null = null;
  @omitif("this.hide") data!: Payload;
  hide: bool = false;
}
export function omittedForward(): string {
  decodes = encodes = 0;
  const value = JSON.parse<OmittedWire>('{"needed":7,"optional":null,"data":9e0,"hide":false}');
  const n = value.needed;
  value.hide = true;
  const text = JSON.stringify(value);
  return n.toString() + "|" + text + "|" + decodes.toString() + ":" + encodes.toString();
}

@json({ lazy: "strategic" })
class ForwardChild {
  hot: f32 = 0;
  cold!: Payload;
}
@json({ lazy: "strategic" })
class ForwardParent {
  needed: i32 = 0;
  child!: ForwardChild;
}
export function nestedReadAfterForward(): string {
  decodes = encodes = 0;
  const value = JSON.parse<ForwardParent>('{"needed":7,"child":{"hot":7e0,"cold":9e0}}');
  const n = value.needed;
  const child = value.child;
  const first = JSON.stringify(value);
  const hot = child.hot;
  const second = JSON.stringify(value);
  return n.toString() + ":" + hot.toString() + "|" + first + "|" + second + "|" + decodes.toString() + ":" + encodes.toString();
}

const globalWire = JSON.parse<Wire>(input);
export function globalDataRead(): i32 { return globalWire.data.n; }
export function globalForward(): string {
  decodes = encodes = 0;
  const text = JSON.stringify(globalWire);
  return text + "|" + decodes.toString() + ":" + encodes.toString();
}
