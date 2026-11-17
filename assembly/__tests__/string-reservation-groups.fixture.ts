// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";

let active: Mixed | null = null;
let suffix: string = "";


@json
class Trigger {

  @serializer("number")
  encode(_self: Trigger): string {
    const parent = active!;
    parent.beforeA = "changed after emission";
    parent.afterA = suffix;
    parent.afterB = suffix + "end";
    parent.nullable = suffix.length ? suffix : null;
    __collect();
    return "7";
  }
}


@json
class Mixed {
  beforeA: string = "";
  beforeB: string = "";
  middle: Trigger = new Trigger();
  afterA: string = "";
  afterB: string = "";
  nullable: string | null = null;
}

export function allocInput(size: i32): usize {
  return changetype<usize>(new ArrayBuffer(size));
}

export function run(ptr: usize): string {
  const input = changetype<string>(ptr);
  const record = new Mixed();
  record.beforeA = input;
  record.beforeB = input + "head";
  record.afterA = "stale";
  record.afterB = "stale";
  active = record;
  suffix = input;
  const result = JSON.stringify(record);
  active = null;
  suffix = "";
  return result;
}
