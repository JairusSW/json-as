// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";
import { __heap_base } from "memory";


@json({ lazy: "strategic" })
class ShadowedParserModel {
  value: i32 = 7;
  unused: string = "unused";
}
class ShadowedParser {
  parse<T>(_data: string): T {
    return instantiate<T>();
  }
}
export function hoistedLocalParser(): i32 {
  {
    // eslint-disable-next-line no-var
    var JSON = new ShadowedParser();
  }
  const value = JSON.parse<ShadowedParserModel>("ignored");
  return value.value;
}

function collectWithRoot<T>(root: T): void {
  if (isDefined(__collect)) {
    const ptr = changetype<usize>(root);
    if (ptr >= __heap_base) __pin(ptr);
    __collect();
    if (ptr >= __heap_base) __unpin(ptr);
  }
}


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
  collectWithRoot(out);
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
  collectWithRoot(value);
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


@json({ lazy: "strategic" })
class ReviewSignedByte {
  value: i8 = 0;
}


@json({ lazy: "strategic" })
class ReviewSignedShort {
  value: i16 = 0;
}


@json({ lazy: "strategic" })
class ReviewOptionalByte {

  @optional value: i8 = -1;
}


@json({ lazy: "strategic" })
class ReviewUnsignedByte {
  value: u8 = 0;
}


@json({ lazy: "strategic" })
class ReviewUnsignedShort {
  value: u16 = 0;
}
export function reviewSignedByte(): i32 {
  const value = JSON.parse<ReviewSignedByte>('{"value":-1}');
  return i32(value.value);
}
export function reviewSignedShort(): i32 {
  const value = JSON.parse<ReviewSignedShort>('{"value":-2}');
  return i32(value.value);
}
export function reviewSignedNegative(): i32 {
  const value = JSON.parse<ReviewSignedByte>('{"value":-1}');
  return value.value < 0 ? 1 : 0;
}
export function reviewUnsignedShort(): i32 {
  const value = JSON.parse<ReviewUnsignedShort>('{"value":65535}');
  return i32(value.value);
}
export function reviewOptionalByte(): i32 {
  const value = JSON.parse<ReviewOptionalByte>('{"value":1}');
  return i32(value.value);
}
export function reviewReusedByte(): i32 {
  const value = JSON.parse<ReviewUnsignedByte>('{"value":1}');
  return i32(JSON.parse<ReviewUnsignedByte>('{"value":2}', value).value);
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
  const value = JSON.parse<ApiDefaults>(
    '{"id":7,"title":"hello","tags":["a","b"]}',
  );
  return value.id.toString() + ":" + value.title;
}

let defaultCalls: i32 = 0;
class DefaultWithEffects {
  constructor() {
    defaultCalls++;
  }
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

export function fullStringFields(): string {
  const value = JSON.parse<Texts>(
    ' { "always" : "a\\\\b", "likely" : "hello", "rare" : "world" } ',
  );
  collectWithRoot(value);
  return value.always + ":" + value.likely + ":" + value.rare;
}


@json({ lazy: "strategic" })
class NullableTexts {
  a: string | null = null;
  b: string | null = null;
}

export function fullNullableStrings(): string {
  const value = JSON.parse<NullableTexts>('{"a":"hi\\u0021", "b":null}');
  collectWithRoot(value);
  return (
    (value.a === null ? "null" : value.a!) +
    ":" +
    i32(value.b === null).toString()
  );
}


@json({ lazy: "strategic" })
class StrategicFlags {
  first: bool = false;
  second: bool = true;
}

export function fullBooleanFields(): string {
  const flags = JSON.parse<StrategicFlags>(
    ' { "first" : true, "second" : false } ',
  );
  return (
    i32(flags.first).toString() +
    ":" +
    i32(flags.second).toString() +
    ":" +
    JSON.stringify(flags)
  );
}

export function booleanFieldVariants(): string {
  const compact = JSON.parse<StrategicFlags>('{"first":true,"second":false}');
  const reordered = JSON.parse<StrategicFlags>('{"second":true,"first":false}');
  const omitted = JSON.parse<StrategicFlags>("{}");
  return (
    i32(compact.first).toString() +
    ":" +
    i32(compact.second).toString() +
    ":" +
    i32(reordered.first).toString() +
    ":" +
    i32(reordered.second).toString() +
    ":" +
    i32(omitted.first).toString() +
    ":" +
    i32(omitted.second).toString()
  );
}

export function invalidBooleanField(): void {
  JSON.parse<StrategicFlags>('{"first":tru,"second":false}');
}

export function invalidBooleanFieldReuse(): void {
  JSON.parse<StrategicFlags>(
    '{"first":tru,"second":false}',
    new StrategicFlags(),
  );
}


@json({ lazy: "auto" })
class ImplicitAutoArray {
  value: i32[];
}


@json
class ImplicitWrappedArray {
  value: JSON.Lazy<i32[]>;
}

class ImplicitArraySubclass extends Array<i32> {
  tag: i32 = 7;
}


@json
class ImplicitSubclassArray {

  @lazy value: ImplicitArraySubclass;
}

type NullableArrayAlias = i32[] | null;


@json
class ImplicitNullableArray {

  @lazy value: NullableArrayAlias;
}

namespace ShadowedArrayRuntime {
  const JSON: i32 = 3;


  @json
  class ImplicitTypedArray {

    @lazy value: Uint8Array;
  }
  export function length(): i32 {
    return new ImplicitTypedArray().value.length + JSON - 3;
  }
}

export function implicitArrayConstruction(): string {
  const auto = new ImplicitAutoArray();
  const wrapped = new ImplicitWrappedArray();
  const subclass = new ImplicitSubclassArray();
  const nullable = new ImplicitNullableArray();
  const nullablePresent = JSON.parse<ImplicitNullableArray>('{"value":[ 1 ]}');
  const parsed = JSON.parse<ImplicitAutoArray>("{}");
  return (
    auto.value.length.toString() +
    ":" +
    wrapped.value.length.toString() +
    ":" +
    parsed.value.length.toString() +
    ":" +
    ShadowedArrayRuntime.length().toString() +
    ":" +
    subclass.value.tag.toString() +
    ":" +
    i32(nullable.value === null).toString() +
    ":" +
    JSON.stringify(nullablePresent)
  );
}


@json
class LazyReferenceStates {

  @optional @lazy value: string | null = null;
}

export function lazyReferenceStates(): string {
  const absent = JSON.parse<LazyReferenceStates>("{}");
  const present = JSON.parse<LazyReferenceStates>('{"value":"hello"}');
  const explicitNull = JSON.parse<LazyReferenceStates>('{"value":null}');
  const first = present.value;
  if (isDefined(__collect)) {
    __pin(changetype<usize>(absent));
    __pin(changetype<usize>(present));
    __pin(changetype<usize>(explicitNull));
    __collect();
    __unpin(changetype<usize>(explicitNull));
    __unpin(changetype<usize>(present));
    __unpin(changetype<usize>(absent));
  }
  const second = present.value;
  present.value = "set";
  return (
    i32(absent.value === null).toString() +
    ":" +
    first! +
    ":" +
    second! +
    ":" +
    i32(explicitNull.value === null).toString() +
    ":" +
    present.value!
  );
}


@json({ lazy: "strategic" })
class NestedVec {
  child: Vec3 = new Vec3();
}
export function nestedFullRead(): string {
  const parent = JSON.parse<NestedVec>('{"child":{"x":1.5,"y":2.5,"z":3.5}}');
  const child = parent.child;
  const before = mask(child);
  const sum = child.x + child.y + child.z;
  return before.toString() + ":" + sum.toString();
}

export function nestedReaderFallback(): string {
  const parent = JSON.parse<NestedVec>(
    '{"child":{"z":3.5,"unknown":0,"x":1.5,"y":2.5}}',
  );
  const child = parent.child;
  collectWithRoot(child);
  return (child.x + child.y + child.z).toString();
}

export function nestedReaderReordered(): string {
  const parent = JSON.parse<NestedVec>('{"child":{"z":3.5,"x":1.5,"y":2.5}}');
  const child = parent.child;
  collectWithRoot(child);
  return (child.x + child.y + child.z).toString();
}


@json({ lazy: "strategic" })
class NestedCodecFallback {
  probe!: Probe;
  tail!: i32;
}
export function nestedCodecFallback(): string {
  calls = 0;
  const value = JSON.parse<NestedCodecFallback>(
    '{"probe":7,"unknown":1,"tail":2}',
  );
  return value.probe.n.toString() + ":" + calls.toString();
}


@json({ lazy: "strategic" })
class PureNestedFallback {
  child!: Vec3;


  @optional tail: i32 = 0;
}
export function pureNestedFallback(): string {
  const value = JSON.parse<PureNestedFallback>(
    '{"child":{"x":1.5,"y":2.5,"z":3.5},"unknown":1,"tail":2}',
  );
  const child = value.child;
  const before = mask(child);
  return (
    before.toString() +
    ":" +
    (child.x + child.y + child.z).toString() +
    ":" +
    value.tail.toString()
  );
}
export function nestedPartialRead(): string {
  const parent = JSON.parse<NestedVec>('{"child":{"x":1.5,"y":2.5,"z":3.5}}');
  const child = parent.child;
  const before = mask(child);
  return before.toString() + ":" + child.x.toString();
}


@json({ lazy: "strategic" })
class NestedVecArray {
  items: Vec3[] = [];
}
export function nestedArrayFullRead(): string {
  const parent = JSON.parse<NestedVecArray>(
    '{"items":[{"x":1.5,"y":2.5,"z":3.5}]}',
  );
  const item = parent.items[0];
  const before = mask(item);
  const sum = item.x + item.y + item.z;
  collectWithRoot(item);
  return before.toString() + ":" + sum.toString();
}


@json({ lazy: "strategic" })
class NestedCodecArray {
  items!: Probe[];
  tail!: i32;
}
export function nestedCodecArrayFallback(): string {
  calls = 0;
  const value = JSON.parse<NestedCodecArray>(
    '{"items":[7],"unknown":1,"tail":2}',
  );
  return value.items[0].n.toString() + ":" + calls.toString();
}

export function nestedArrayPartialRead(): string {
  const parent = JSON.parse<NestedVecArray>(
    '{"items":[{"x":1.5,"y":2.5,"z":3.5}]}',
  );
  const item = parent.items[0];
  const before = mask(item);
  return before.toString() + ":" + item.x.toString();
}
export function nestedArrayLoopRead(): string {
  const parent = JSON.parse<NestedVecArray>(
    '{"items":[{"x":1.5,"y":2.5,"z":3.5},{"x":4.5,"y":5.5,"z":6.5}]}',
  );
  const values = parent.items;
  let masks: i32 = 0;
  let sum: f32 = 0;
  for (let i = 0; i < values.length; i++) {
    const item = values[i];
    masks += mask(item);
    sum += item.x + item.y + item.z;
  }
  return masks.toString() + ":" + sum.toString();
}


@json({ lazy: "strategic" })
class OverwrittenNestedInner {
  probe!: Probe;
}


@json({ lazy: "strategic" })
class OverwrittenNestedOuter {
  child!: OverwrittenNestedInner;
}
export function overwrittenNestedChild(): string {
  calls = 0;
  const value = JSON.parse<OverwrittenNestedOuter>('{"child":{"probe":7}}');
  value.child = new OverwrittenNestedInner();
  return value.child.probe.n.toString() + ":" + calls.toString();
}


@json({ lazy: "strategic" })
class AliasedNestedVec {

  @alias("wire") child!: Vec3;
}
export function aliasedNestedFullRead(): string {
  const parent = JSON.parse<AliasedNestedVec>(
    '{"wire":{"x":1.5,"y":2.5,"z":3.5}}',
  );
  const child = parent.child;
  const before = mask(child);
  return before.toString() + ":" + (child.x + child.y + child.z).toString();
}


@json({ lazy: "strategic" })
class MissingNestedDefaults {

  @optional x: i32 = 1;


  @optional y: i32 = 7;


  @optional z: string = "tail";
}


@json({ lazy: "strategic" })
class MissingNestedParent {
  child!: MissingNestedDefaults;
}
export function missingNestedDefaults(): string {
  const parent = JSON.parse<MissingNestedParent>('{"child":{"x":3}}');
  return (
    parent.child.x.toString() +
    ":" +
    parent.child.y.toString() +
    ":" +
    parent.child.z
  );
}


@json({ lazy: "all" })
class ExplicitNestedLazy {
  x: i32 = 0;
}


@json({ lazy: "strategic" })
class StrategicWithExplicitChild {
  child!: ExplicitNestedLazy;
}
export function explicitLazyNested(): string {
  const parent = JSON.parse<StrategicWithExplicitChild>('{"child":{"x":7}}');
  const child = parent.child;
  const before = i32(
    load<u64>(
      changetype<usize>(child),
      offsetof<ExplicitNestedLazy>("__x_lz"),
    ) >>>
      32 ==
      0xffffffff,
  );
  return before.toString() + ":" + child.x.toString();
}


@json({ lazy: "strategic" })
class MissingArrayParent {
  items!: MissingNestedDefaults[];
}
export function missingArrayDefaults(): string {
  const parent = JSON.parse<MissingArrayParent>('{"items":[{"x":3}]}');
  const child = parent.items[0];
  return child.x.toString() + ":" + child.y.toString() + ":" + child.z;
}

export function nestedArrayWhitespaceAndReordering(): string {
  const parent = JSON.parse<MissingArrayParent>(
    ' { "items" : [ { "z" : "a\\u2028b", "x" : 4 }, { "y" : 8, "x" : 5 } ] } ',
  );
  const first = parent.items[0];
  const second = parent.items[1];
  collectWithRoot(parent);
  return (
    first.x.toString() +
    ":" +
    first.y.toString() +
    ":" +
    first.z.length.toString() +
    ":" +
    second.x.toString() +
    ":" +
    second.y.toString() +
    ":" +
    second.z
  );
}

export function nestedEmptyArray(): i32 {
  const parent = JSON.parse<MissingArrayParent>('{"items":[]}');
  collectWithRoot(parent);
  return parent.items.length;
}

export function nestedFullReadAfterGC(): string {
  const parent = JSON.parse<AliasedNestedVec>(
    '{"wire":{"x":1.5,"y":2.5,"z":3.5}}',
  );
  const child = parent.child;
  collectWithRoot(child);
  const before = mask(child);
  return before.toString() + ":" + (child.x + child.y + child.z).toString();
}

function replaceNestedChild(value: OverwrittenNestedOuter): void {
  value.child = new OverwrittenNestedInner();
}
export function unknownNestedWrite(): string {
  calls = 0;
  const value = JSON.parse<OverwrittenNestedOuter>('{"child":{"probe":7}}');
  const replace = replaceNestedChild;
  replace(value);
  return value.child.probe.n.toString() + ":" + calls.toString();
}
export function nestedArrayGrowthAfterGC(): string {
  let input = '{"items":[';
  for (let i = 0; i < 48; i++) {
    if (i) input += ",";
    input += '{"x":1.5,"y":2.5,"z":3.5}';
  }
  input += "]}";
  const parent = JSON.parse<NestedVecArray>(input);
  collectWithRoot(parent);
  let masks: i32 = 0;
  let sum: f32 = 0;
  for (let i = 0; i < parent.items.length; i++) {
    const item = parent.items[i];
    masks += mask(item);
    sum += item.x + item.y + item.z;
  }
  return masks.toString() + ":" + sum.toString();
}

type ProbeArrayAlias = Probe[];


@json({ lazy: "all" })
class EagerArrayForms {

  @lazy decorated!: Probe[];
  wrapped!: JSON.Lazy<ProbeArrayAlias>;
  implicit!: Probe[];
}

export function arrayFormsDecodeEagerly(): string {
  calls = 0;
  const value = JSON.parse<EagerArrayForms>(
    '{"decorated":[7],"wrapped":[8],"implicit":[9]}',
  );
  const before = calls;
  return (
    before.toString() +
    ":" +
    value.decorated[0].n.toString() +
    ":" +
    value.wrapped[0].n.toString() +
    ":" +
    value.implicit[0].n.toString() +
    ":" +
    calls.toString()
  );
}


@json
class SharedArrayDefaults {

  @lazy a: i32[] = [];


  @lazy b: i32[] = this.a;
}

export function eagerArraysRespectReuseOwnership(): string {
  const value = JSON.parse<SharedArrayDefaults>('{"a":[1],"b":[2]}');
  const first = JSON.stringify(value);
  JSON.parse<SharedArrayDefaults>('{"a":[3],"b":[4]}', value);
  return first + "|" + JSON.stringify(value);
}


@json
class GenericArrayField<T> {
  value!: JSON.Lazy<T>;
}


@json
class ConcreteInheritedArray extends GenericArrayField<Probe[]> {
  tail: i32 = 0;
}

export function inheritedGenericArrayDecodesEagerly(): string {
  calls = 0;
  const value = JSON.parse<ConcreteInheritedArray>('{"value":[7],"tail":9}');
  const before = calls;
  return (
    before.toString() +
    ":" +
    value.value[0].n.toString() +
    ":" +
    value.tail.toString() +
    ":" +
    calls.toString()
  );
}

export function genericArrayFieldDecodesEagerly(): string {
  calls = 0;
  const value = JSON.parse<GenericArrayField<Probe[]>>('{"value":[7]}');
  const before = calls;
  return (
    before.toString() +
    ":" +
    value.value[0].n.toString() +
    ":" +
    calls.toString()
  );
}

export function genericTypedArrayFieldDecodesEagerly(): string {
  const value = JSON.parse<GenericArrayField<Uint8Array>>('{"value":[ 1, 2 ]}');
  return JSON.stringify(value);
}

export function genericNullableArrayFieldDecodesEagerly(): string {
  calls = 0;
  const present =
    JSON.parse<GenericArrayField<Probe[] | null>>('{"value":[7]}');
  const before = calls;
  const absent =
    JSON.parse<GenericArrayField<Probe[] | null>>('{"value":null}');
  const items = present.value;
  return (
    before.toString() +
    ":" +
    (items === null ? -1 : items[0].n).toString() +
    ":" +
    i32(absent.value === null).toString() +
    ":" +
    calls.toString()
  );
}

class ProbeArraySubclass extends Array<Probe> {}


@json
class SubclassArrayField {

  @lazy value!: ProbeArraySubclass;


  @optional tail: i32 = 0;
}

export function subclassArrayFallbackDoesNotReplay(): string {
  calls = 0;
  const value = JSON.parse<SubclassArrayField>(
    '{"value":[7],"unknown":1,"tail":9}',
  );
  return (
    calls.toString() +
    ":" +
    value.value[0].n.toString() +
    ":" +
    value.tail.toString()
  );
}

export function subclassArrayFieldDecodesEagerly(): string {
  calls = 0;
  const value = JSON.parse<SubclassArrayField>('{"value":[7]}');
  const before = calls;
  return (
    before.toString() +
    ":" +
    value.value[0].n.toString() +
    ":" +
    calls.toString()
  );
}

export function genericSubclassArrayFieldDecodesEagerly(): string {
  calls = 0;
  const value =
    JSON.parse<GenericArrayField<ProbeArraySubclass>>('{"value":[7]}');
  const before = calls;
  return (
    before.toString() +
    ":" +
    value.value[0].n.toString() +
    ":" +
    calls.toString()
  );
}


@json
class CustomArraySubclass extends Array<i32> {

  @deserializer("number") decode(data: string): CustomArraySubclass {
    calls++;
    const out = new CustomArraySubclass();
    out.push(<i32>parseInt(data));
    return out;
  }
}


@json
class CustomArrayField {

  @lazy value!: CustomArraySubclass;
}

export function customArrayFieldDecodesEagerly(): string {
  calls = 0;
  const value = JSON.parse<CustomArrayField>('{"value":7}');
  const before = calls;
  return (
    before.toString() + ":" + value.value[0].toString() + ":" + calls.toString()
  );
}

namespace ShadowArrayName {

  @json
  export class Uint8Array {
    n: i32 = 0;
  }
}


@json
class ShadowArrayHolder {
  item!: JSON.Lazy<ShadowArrayName.Uint8Array>;
}

export function userNamedArrayRemainsLazy(): string {
  const value = JSON.parse<ShadowArrayHolder>('{"item":{ "n" : 7 }}');
  return JSON.stringify(value);
}

export function dynamicArrayStillDefersElements(): string {
  const value = JSON.parse<JSON.Arr>('[{"n":7}]');
  const before = JSON.Value.slotIsLazy(unchecked(value._vals[0]));
  const item = value.getAs<JSON.Obj>(0);
  const after = JSON.Value.slotIsLazy(unchecked(value._vals[0]));
  return (
    i32(before).toString() +
    ":" +
    item.getAs<f64>("n").toString() +
    ":" +
    i32(after).toString()
  );
}

export function genericDynamicArrayFieldDecodesEagerly(): string {
  const value = JSON.parse<GenericArrayField<JSON.Arr>>('{"value":[{"n":7}]}');
  const eager =
    load<u64>(
      changetype<usize>(value),
      offsetof<GenericArrayField<JSON.Arr>>("__value_lz"),
    ) == u64.MAX_VALUE;
  const array = value.value;
  const elementLazy = JSON.Value.slotIsLazy(unchecked(array._vals[0]));
  return i32(eager).toString() + ":" + i32(elementLazy).toString();
}


@json
class DynamicArrayField {

  @lazy value!: JSON.Arr;
}

export function dynamicArrayFieldDecodesEagerly(): string {
  const value = JSON.parse<DynamicArrayField>('{"value":[ { "n":7 } ]}');
  const wire = JSON.stringify(value);
  return (
    wire +
    ":" +
    i32(JSON.Value.slotIsLazy(unchecked(value.value._vals[0]))).toString()
  );
}


@json({ lazy: "strategic" })
class NullableVecArray {
  items!: (Vec3 | null)[];
}
export function nullableNestedArrayRead(): string {
  const parent = JSON.parse<NullableVecArray>(
    '{"items":[null,{"x":1.5,"y":2.5,"z":3.5}]}',
  );
  const child = parent.items[1];
  if (child === null) return "bad";
  const before = mask(child);
  return (
    i32(parent.items[0] === null).toString() +
    ":" +
    before.toString() +
    ":" +
    (child.x + child.y + child.z).toString()
  );
}
