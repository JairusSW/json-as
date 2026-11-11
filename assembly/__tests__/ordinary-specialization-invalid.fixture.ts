// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";

@json
class Record {
  id: i32 = 0;
  ignored: string = "";
}

export function read(input: string): i32 {
  const value = JSON.parse<Record>(input);
  return value.id;
}

export function makeInput(which: i32): string {
  if (which == 0) return '{"id":7,"ignored":"valid\\ntext"}';
  if (which == 1) return '{"id":7,"ignored":"invalid\\q"}';
  if (which == 2) return '{"id":7,"ignored":{}}';
  if (which == 3) return '{"id":7,"ignored":"unfinished}';
  if (which == 4) return '{"id":7,"ignored":"\\u123x"}';
  return '{"ignored":"valid","id":7}';
}

@json
class Numeric {
  id: i32 = 0;
  signed: i32 = 0;
  unsigned: u32 = 0;
  decimal: f64 = 0;
  flag: bool = false;
}

export function readNumeric(input: string): i32 {
  const value = JSON.parse<Numeric>(input);
  return value.id;
}

export function makeNumericInput(which: i32): string {
  if (which == 0) return '{"id":7,"signed":-2,"unsigned":3,"decimal":1.5e2,"flag":true}';
  if (which == 1) return '{"id":7,"signed":1.5,"unsigned":3,"decimal":1.5,"flag":true}';
  if (which == 2) return '{"id":7,"signed":1,"unsigned":-2,"decimal":1.5,"flag":true}';
  if (which == 3) return '{"id":7,"signed":1e2,"unsigned":3,"decimal":1.5,"flag":true}';
  if (which == 4) return '{"id":7,"signed":1,"unsigned":3,"decimal":{},"flag":true}';
  if (which == 5) return '{"id":7,"signed":1,"unsigned":3,"decimal":1.5,"flag":null}';
  if (which == 6) return '{"id":7,"signed":01,"unsigned":3,"decimal":1.5,"flag":true}';
  if (which == 7) return '{"id":7,"signed":1,"unsigned":3,"decimal":1e,"flag":true}';
  return '{"id":7,"signed":1,"unsigned":-0,"decimal":1.5,"flag":true}';
}
