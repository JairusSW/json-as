// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";


@json({ lazy: "strategic" })
class Vec3 {

  @optional x: f32 = 0;


  @optional y: f32 = 0;


  @optional z: f32 = 0;
  readX(): f32 {
    return this.x;
  }
}
function mask(value: Vec3): i32 {
  const ptr = changetype<usize>(value);
  return (
    i32(load<u64>(ptr, offsetof<Vec3>("__x_lz")) >>> 32 == 0xffffffff) |
    (i32(load<u64>(ptr, offsetof<Vec3>("__y_lz")) >>> 32 == 0xffffffff) << 1) |
    (i32(load<u64>(ptr, offsetof<Vec3>("__z_lz")) >>> 32 == 0xffffffff) << 2)
  );
}
const input = '{"x":1.5,"y":2.5,"z":3.5}';

export function xOnly(): string {
  const vec = JSON.parse<Vec3>(input);
  return mask(vec).toString() + ":" + vec.x.toString();
}
export function yOnly(): string {
  const vec = JSON.parse<Vec3>(input);
  return mask(vec).toString() + ":" + vec.y.toString();
}
export function unused(): i32 {
  const vec = JSON.parse<Vec3>(input);
  return mask(vec);
}
export function nested(a: bool, b: bool, c: bool): string {
  const vec = JSON.parse<Vec3>(input);
  const before = mask(vec);
  let sum: f32 = vec.x;
  if (a) if (b) if (c) sum += vec.y;
  return before.toString() + ":" + sum.toString();
}
export function halves(a: bool): string {
  const vec = JSON.parse<Vec3>(input);
  const before = mask(vec);
  let sum: f32 = 0;
  if (a) sum += vec.x;
  else sum += vec.x;
  return before.toString() + ":" + sum.toString();
}
export function alias(): string {
  const vec = JSON.parse<Vec3>(input);
  const other = vec;
  return mask(vec).toString() + ":" + other.z.toString();
}
export function reordered(): string {
  const vec = JSON.parse<Vec3>('{"z":3.5,"x":1.5,"y":2.5}');
  return mask(vec).toString() + ":" + vec.x.toString();
}
export function whitespace(): string {
  const vec = JSON.parse<Vec3>(' { "x" : 1.5, "y" : 2.5, "z" : 3.5 } ');
  return mask(vec).toString() + ":" + vec.x.toString();
}
export function reused(): string {
  const out = JSON.parse<Vec3>(input);
  const vec = JSON.parse<Vec3>('{"x":4.5,"z":6.5}', out);
  return (
    i32(changetype<usize>(vec) == changetype<usize>(out)).toString() +
    ":" +
    vec.x.toString() +
    ":" +
    vec.y.toString() +
    ":" +
    vec.z.toString()
  );
}


@json({ lazy: "strategic" })
class Texts {
  always: string = "";
  likely: string = "";
  rare: string = "";
}
function textMask(value: Texts): i32 {
  const ptr = changetype<usize>(value);
  return (
    i32(load<u64>(ptr, offsetof<Texts>("__always_lz")) == u64.MAX_VALUE) |
    (i32(load<u64>(ptr, offsetof<Texts>("__likely_lz")) == u64.MAX_VALUE) <<
      1) |
    (i32(load<u64>(ptr, offsetof<Texts>("__rare_lz")) == u64.MAX_VALUE) << 2)
  );
}
export function texts(a: bool, b: bool, c: bool): string {
  const value = JSON.parse<Texts>(
    '{"always":"a\\b","likely":"hello","rare":"world"}',
  );
  const before = textMask(value);
  let out = value.always;
  if (a) out += value.likely;
  if (b) out += value.likely;
  if (c) out += value.likely;
  if (a) if (b) if (c) out += value.rare;
  if (isDefined(__collect)) __collect();
  return before.toString() + ":" + out;
}

let calls: i32 = 0;


@json
class Probe {
  n: i32 = 0;


  @deserializer("number") decode(data: string): Probe {
    calls++;
    const out = new Probe();
    out.n = <i32>parseInt(data);
    return out;
  }
}


@json({ lazy: "strategic" })
class CustomHolder {
  probe: Probe = new Probe();
  tail: i32 = 0;
}
export function custom(): string {
  calls = 0;
  const value = JSON.parse<CustomHolder>('{"probe":7,"tail":2}');
  const before = calls;
  return (
    before.toString() + ":" + value.probe.n.toString() + ":" + calls.toString()
  );
}


@json
class ExistingLazy {
  x: JSON.Lazy<i32> = 0;
  y: JSON.Lazy<i32> = 0;
}
export function existing(): string {
  const value = JSON.parse<ExistingLazy>('{"x":7,"y":8}');
  const before = i32(
    load<u64>(changetype<usize>(value), offsetof<ExistingLazy>("__x_lz")) >>>
      32 ==
      0xffffffff,
  );
  return before.toString() + ":" + value.x.toString();
}
function readZ(value: Vec3): f32 {
  return value.z;
}
export function helper(): string {
  const value = JSON.parse<Vec3>(input);
  const before = mask(value);
  return before.toString() + ":" + readZ(value).toString();
}


@json({ lazy: "strategic" })
class Generic<T> {
  value!: T;
  unused!: T;
}
export function generic(): string {
  const value = JSON.parse<Generic<i32>>('{"value":7,"unused":8}');
  const before = i32(
    load<u64>(changetype<usize>(value), offsetof<Generic<i32>>("__value_lz")) ==
      u64.MAX_VALUE,
  );
  return before.toString() + ":" + value.value.toString();
}


@json({ lazy: "strategic" })
class Parent {
  inherited: f32 = 0;
}


@json
class Child extends Parent {
  tail: i32 = 0;
}
export function inherited(): string {
  const value = JSON.parse<Child>('{"inherited":7.5,"tail":9}');
  const before = i32(
    load<u64>(changetype<usize>(value), offsetof<Child>("__inherited_lz")) >>>
      32 ==
      0xffffffff,
  );
  return before.toString() + ":" + value.inherited.toString();
}

export function method(): string {
  const value = JSON.parse<Vec3>(input);
  const before = mask(value);
  return before.toString() + ":" + value.readX().toString();
}

function ownedSource(seed: i32): Vec3 {
  const value = JSON.parse<Vec3>(
    '{"x":' + seed.toString() + ',"y":2.5,"z":3.5}',
  );
  if (value.x < 0) unreachable();
  return value;
}
export function gcDeferred(): string {
  const value = ownedSource(1);
  const before = mask(value);
  if (isDefined(__collect)) __collect();
  return before.toString() + ":" + value.y.toString();
}


@json({ lazy: "strategic" })
class Scalars {

  @alias("signed8") a: i8 = 0;
  b: u8 = 0;
  c: i16 = 0;
  d: u16 = 0;
  e: i32 = 0;
  f: u32 = 0;
  g: i64 = 0;
  h: u64 = 0;
  i: f32 = 0;
  j: f64 = 0;
}
const scalarsInput =
  '{"signed8":-128,"b":255,"c":-32768,"d":65535,"e":-2147483648,"f":4294967295,"g":-9223372036854775808,"h":18446744073709551615,"i":-1.25,"j":2.5}';
function coldScalars(): Scalars {
  return JSON.parse<Scalars>(scalarsInput);
}
export function scalars(): string {
  const out = coldScalars();
  const value = JSON.parse<Scalars>(scalarsInput, out);
  const ptr = changetype<usize>(value);
  const materialized =
    i32(load<u64>(ptr, offsetof<Scalars>("__a_lz")) >>> 32 == 0xffffffff) +
    i32(load<u64>(ptr, offsetof<Scalars>("__b_lz")) >>> 32 == 0xffffffff) +
    i32(load<u64>(ptr, offsetof<Scalars>("__c_lz")) >>> 32 == 0xffffffff) +
    i32(load<u64>(ptr, offsetof<Scalars>("__d_lz")) >>> 32 == 0xffffffff) +
    i32(load<u64>(ptr, offsetof<Scalars>("__e_lz")) >>> 32 == 0xffffffff) +
    i32(load<u64>(ptr, offsetof<Scalars>("__f_lz")) >>> 32 == 0xffffffff) +
    i32(load<u64>(ptr, offsetof<Scalars>("__g_lz")) >>> 32 == 0xffffffff) +
    i32(load<u64>(ptr, offsetof<Scalars>("__h_lz")) >>> 32 == 0xffffffff) +
    i32(load<u64>(ptr, offsetof<Scalars>("__i_lz")) >>> 32 == 0xffffffff) +
    i32(load<u64>(ptr, offsetof<Scalars>("__j_lz")) >>> 32 == 0xffffffff);
  return (
    materialized.toString() +
    ":" +
    value.a.toString() +
    ":" +
    value.b.toString() +
    ":" +
    value.c.toString() +
    ":" +
    value.d.toString() +
    ":" +
    value.e.toString() +
    ":" +
    value.f.toString() +
    ":" +
    value.g.toString() +
    ":" +
    value.h.toString() +
    ":" +
    value.i.toString() +
    ":" +
    value.j.toString()
  );
}

type Small = i32;

@json({ lazy: "strategic" })
class AliasedScalar {
  value: Small = 0;
}
export function conditionalAlias(condition: bool): string {
  const value = JSON.parse<AliasedScalar>('{"value":7}');
  const before = i32(
    load<u64>(
      changetype<usize>(value),
      offsetof<AliasedScalar>("__value_lz"),
    ) == u64.MAX_VALUE,
  );
  return condition
    ? before.toString() + ":" + value.value.toString()
    : before.toString();
}

@json({ lazy: "strategic" })
class ApiDefaults {
  id!: i64;
  title!: string;
  tags!: string[];
}
export function apiFastCapability(): bool {
  return changetype<ApiDefaults>(0).__DESERIALIZE_FAST_ENABLED();
}
export function apiSummary(): string {
  const value = JSON.parse<ApiDefaults>('{"id":7,"title":"hello","tags":["a","b"]}');
  return value.id.toString() + ":" + value.title;
}

let defaultCalls: i32 = 0;
class DefaultWithEffects {
  constructor() { defaultCalls++; }
}
@json({ lazy: "strategic" })
class EffectfulDefaults {
  child!: DefaultWithEffects;
  @optional tail: i32 = 0;
}
export function effectfulDefaultCapability(): bool {
  return changetype<EffectfulDefaults>(0).__DESERIALIZE_FAST_ENABLED();
}
export function effectfulDefaultCount(): i32 {
  defaultCalls = 0;
  const values = JSON.parse<EffectfulDefaults[]>('[{"tail":7}]');
  return defaultCalls + values.length - 1;
}

class InheritedDefaultWithEffects extends DefaultWithEffects {}
@json({ lazy: "strategic" })
class InheritedEffectfulDefaults {
  child!: InheritedDefaultWithEffects;
  @optional tail: i32 = 0;
}
export function inheritedEffectfulDefaultCapability(): bool {
  return changetype<InheritedEffectfulDefaults>(0).__DESERIALIZE_FAST_ENABLED();
}

@json
class LifecycleDefault {
  value: i32 = 0;
  __INITIALIZE(): this {
    defaultCalls++;
    this.value = 7;
    return this;
  }
}
@json({ lazy: "strategic" })
class LifecycleDefaults {
  child!: LifecycleDefault;
  @optional tail: i32 = 0;
}
export function lifecycleDefaultCapability(): bool {
  return changetype<LifecycleDefaults>(0).__DESERIALIZE_FAST_ENABLED();
}
export function lifecycleDefaultCount(): i32 {
  defaultCalls = 0;
  const values = JSON.parse<LifecycleDefaults[]>('[{"tail":7}]');
  return defaultCalls + values.length - 1;
}
