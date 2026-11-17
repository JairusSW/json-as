// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import { bs } from "../../lib/as-bs";

@json({ nolazy })
class BudgetRow { n: i64 = 0; }

@json
class LazyBudget {
  first: JSON.Lazy<string> = "";
  @optional scalar: JSON.Lazy<i32> = 7;
  @optional wide: JSON.Lazy<i64> = 8;
  @optional nullable: JSON.Lazy<string | null> = null;
  @optional flag: JSON.Lazy<bool> = true;
  @optional ratio: JSON.Lazy<f64> = 1.5;
  @optional missing!: JSON.Lazy<string | null>;
  @optional rows: BudgetRow[] = [];
  @optional future: i64[] = [];
}

export function render(length: i32, materialized: bool, append: bool, held: bool): string {
  assert(isDefined(changetype<BudgetRow>(0).__SERIALIZE_FLAT_NUMERIC_FIELDS) == (ASC_RUNTIME == 2));
  const text = "x".repeat(length);
  const value = JSON.parse<LazyBudget>('{"first":"' + text + '"}');
  if (materialized) {
    assert(value.first.length == length);
    value.missing = null;
  }
  for (let i = 0; i < 64; i++) {
    const row = new BudgetRow(); row.n = i; value.rows.push(row);
  }
  value.future = [42, 43];
  bs.reset();
  const tail = 1 << 20;
  if (append && held) bs.proposeSize(tail);
  JSON.__serialize(value);
  if (append) {
    if (!held) bs.proposeSize(tail);
    assert(bs.offset - bs.buffer + tail <= bs.bufferSize,
      "The next reservation must cover the actual write cursor");
    for (let end = bs.offset + tail; bs.offset < end; bs.offset += 2) {
      store<u16>(bs.offset, 32);
    }
  }
  assert(bs.stackSize >= bs.offset - bs.buffer,
    "Lazy output bytes must remain in the reservation budget");
  return bs.out<string>();
}

function unusedBudget<T>(rows: T, credit: i32): i32 {
  bs.reset();
  bs.proposeSize(credit);
  JSON.__serialize(rows);
  const unused = bs.stackSize - (bs.offset - bs.buffer);
  if (ASC_RUNTIME == 2) assert(unused == <usize>credit,
    "Unused row estimates must be retired while preserving caller credits");
  bs.reset();
  return <i32>unused;
}

export function rowBudget(count: i32, credit: i32, nullable: bool): i32 {
  if (nullable) {
    const rows = new Array<BudgetRow | null>(count);
    for (let i = 0; i < count; i++) {
      if (i % 3 == 2) rows[i] = null;
      else {
        const row = new BudgetRow(); row.n = i; rows[i] = row;
      }
    }
    return unusedBudget(rows, credit);
  }
  const rows = new Array<BudgetRow>(count);
  for (let i = 0; i < count; i++) {
    const row = new BudgetRow(); row.n = i; rows[i] = row;
  }
  return unusedBudget(rows, credit);
}
