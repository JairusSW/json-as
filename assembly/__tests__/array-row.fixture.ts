// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON as J } from "../index";
namespace JSON {
  export const application: i32 = 1;
}
const bs: i32 = 2;
import { src, length, i, ptr as Pointer } from "./array-row-alias.fixture";

const __json_as_flat_strings_0_id: i32 = 3;
type __json_as_flat_strings_1_array = i32;
type i64 = i32;


@json({ nolazy })
class ForwardGroup {
  items: Row[] = [];
}


@json({ nolazy })
class ForwardGroups {
  values: ForwardGroup[] = [new ForwardGroup()];
}


@json({ nolazy })
class Row {
  signed: i8 = -1;
  unsigned: u16 = 65535;
  wide: u64 = 18446744073709551615;
  enabled: bool = true;
  values: i32[] = [];
}


@json({ nolazy })
class Holder {
  rows: (Row | null)[] = [];
}

export function selected(): bool {
  return isDefined(changetype<Row>(0).__SERIALIZE_FLAT_NUMERIC_FIELDS);
}

export function verify(): string {
  const holder = new Holder();
  const row = new Row();
  row.values = [-2147483648, 0, 2147483647];
  holder.rows = [null, row];
  const first = J.stringify(holder);
  if (ASC_RUNTIME == 2) __collect();
  assert(first == J.stringify(holder));
  return first;
}

function makeRows(count: i32, width: i32): Row[] {
  const rows = new Array<Row>(count);
  for (let i = 0; i < count; i++) {
    const row = new Row();
    row.values = new Array<i32>(width);
    for (let j = 0; j < width; j++) row.values[j] = i * width + j;
    rows[i] = row;
  }
  return rows;
}


@inline
function writeRows(rows: Row[], requireCollection: bool): string {
  const before = gcSteps();
  const result = J.stringify(rows);
  if (isDefined(__rowGcSteps) && requireCollection) {
    assert(gcSteps() > before, "Collection must run inside serialization");
  }
  return result;
}

export function growth(count: i32, width: i32): string {
  // The temporary array is the sole owner of each borrowed row. Output growth
  // must keep this entire managed ownership chain alive through collection.
  return writeRows(makeRows(count, width), count == 40);
}

class RowArray extends Array<Row> {}
export function subclass(): string {
  const rows = new RowArray();
  rows.push(new Row());
  return J.stringify(rows);
}


@json({ nolazy })
class ptr {
  src: src = -9223372036854775808;
  length: length = 9;
  i: i = -7;
  pointer: Pointer = 11;
  values: i32[] = [1, 2];
}


@json({ nolazy })
class PointerHolder {
  rows: ptr[] = [];
}

export function binding(): string {
  const value = new PointerHolder();
  value.rows = [new ptr()];
  const collision: __json_as_flat_strings_1_array = __json_as_flat_strings_0_id;
  assert(collision == 3);
  assert(JSON.application + bs == 3);
  assert(
    isDefined(changetype<ptr>(0).__SERIALIZE_FLAT_NUMERIC_FIELDS) ==
      (ASC_RUNTIME == 2),
  );
  return J.stringify(value);
}

export function gcSteps(): i32 {
  if (isDefined(__rowGcSteps)) return __rowGcSteps();
  return 0;
}


@json({ nolazy })
class Collision {
  value: i32 = 5;
  __SERIALIZE_FLAT_NUMERIC_FIELDS(): i32 {
    return 91;
  }
}


@json({ nolazy })
class Custom {
  value: i32 = 7;


  @serializer("number")
  encode(self: Custom): string {
    return self.value.toString();
  }
}


@json({ nolazy })
class ParentRow {
  value: i32 = 8;
}


@json({ nolazy })
class ChildRow extends ParentRow {
  other: i32 = 9;
}


@json({ nolazy })
class Fallbacks {
  collisions: Collision[] = [new Collision()];
  customs: Custom[] = [new Custom()];
  parents: ParentRow[] = [new ChildRow()];
}

export function fallbacks(): string {
  const value = new Fallbacks();
  assert(value.collisions[0].__SERIALIZE_FLAT_NUMERIC_FIELDS() == 91);
  assert(!isDefined(changetype<Custom>(0).__SERIALIZE_FLAT_NUMERIC_FIELDS));
  assert(!isDefined(changetype<ParentRow>(0).__SERIALIZE_FLAT_NUMERIC_FIELDS));
  assert(!isDefined(changetype<ChildRow>(0).__SERIALIZE_FLAT_NUMERIC_FIELDS));
  return J.stringify(value);
}


@json({ nolazy })
class Group {
  tag: i32 = 4;
  items: (Row | null)[] = [];
}


@json({ nolazy })
class Groups {
  values: Group[] = [];
}
export function nestedSelected(): bool {
  return isDefined(changetype<Group>(0).__SERIALIZE_FLAT_NUMERIC_FIELDS);
}
function makeGroups(count: i32, width: i32): Group[] {
  const rows = makeRows(count, width);
  const groups = new Array<Group>(count);
  for (let i = 0; i < count; i++) {
    const group = new Group();
    group.items = [null, rows[i]];
    groups[i] = group;
  }
  return groups;
}


@inline
function writeGroups(groups: Group[], requireCollection: bool): string {
  const before = gcSteps();
  const result = J.stringify(groups);
  if (isDefined(__rowGcSteps) && requireCollection) {
    assert(
      gcSteps() > before,
      "Collection must run inside nested serialization",
    );
  }
  return result;
}
export function nested(count: i32, width: i32): string {
  return writeGroups(makeGroups(count, width), count == 40);
}


@json({ nolazy })
class EffectGroup {
  items: Custom[] = [new Custom()];
}


@json({ nolazy })
class EffectGroups {
  values: EffectGroup[] = [new EffectGroup()];
}
export function nestedFallback(): string {
  assert(
    !isDefined(changetype<EffectGroup>(0).__SERIALIZE_FLAT_NUMERIC_FIELDS),
  );
  return J.stringify(new EffectGroups());
}


@json({ nolazy })
class RecursiveGroup {
  children: RecursiveGroup[] = [];
}


@json({ nolazy })
class RecursiveGroups {
  values: RecursiveGroup[] = [new RecursiveGroup()];
}
export function graphFallbacks(): string {
  assert(
    isDefined(changetype<ForwardGroup>(0).__SERIALIZE_FLAT_NUMERIC_FIELDS) ==
      (ASC_RUNTIME == 2),
  );
  assert(
    !isDefined(changetype<RecursiveGroup>(0).__SERIALIZE_FLAT_NUMERIC_FIELDS),
  );
  return (
    J.stringify(new ForwardGroups()) + "|" + J.stringify(new RecursiveGroups())
  );
}


@json({ nolazy })
class LiteralAliasRow {

  @alias("bs.offset = __dst;") value: i32 = 7;
  values: i32[] = [1, 2];
}


@json({ nolazy })
class LiteralAliasRows {
  rows: LiteralAliasRow[] = [new LiteralAliasRow()];
}
export function literalAlias(): string {
  return J.stringify(new LiteralAliasRows());
}

const __json_numeric_batch_0_original: i32 = 19;


@json({ nolazy })
class ConstantRow {
  signed: src = -9223372036854775808;
  wide: u64 = 18446744073709551615;
  enabled: bool = true;
}


@json({ nolazy })
class ConstantRows {
  rows: (ConstantRow | null)[] = [];
}
export function constantRows(count: i32): string {
  assert(__json_numeric_batch_0_original == 19);
  const value = new ConstantRows();
  for (let i = 0; i < count; i++)
    value.rows.push(i % 3 == 0 ? null : new ConstantRow());
  return J.stringify(value);
}
