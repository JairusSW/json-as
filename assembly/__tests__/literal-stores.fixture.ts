// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";
import Model from "./literal-store-model.fixture";


@json
class Labels {

  @alias("hello\ud83d\ude00")
  value: i32 = 7;


  @alias("abcd\uffff")
  text: string = "\ud83d\ude00content";


  @alias("abcd\u8000")
  other: string = "literal\u8000\uffff";
}

export function run(kind: i32): string {
  const source = JSON.stringify(new Labels());
  if (kind == 0) return source;
  if (kind == 1) return JSON.stringify(JSON.parse<Labels>(source));
  return JSON.stringify(JSON.parse<Labels>(source, new Labels()));
}

const __json_literal_store_0: i32 = 19;
namespace WidthAliases {
  type u64 = u8;
  type u32 = u8;
  type u16 = u8;
  type v128 = i32;

  @json({ nolazy })
  class Record {
    @alias("x") a: i32 = 7;
    @alias("ab") b: i32 = 8;
    @alias("long\u8000\uffff\ud83d\ude00key") c: i32 = 9;
  }

  export function encode(): string { return JSON.stringify(new Record()); }
}

@json({ nolazy })
class GenericWidths<u64, u32, u16> {
  @alias("x") a: i32 = 7;
  @alias("ab") b: i32 = 8;
  @alias("long\u8000\uffff\ud83d\ude00key") c: i32 = 9;
}

export function scopedWidths(generic: bool): string {
  assert(__json_literal_store_0 == 19);
  return generic
    ? JSON.stringify(new GenericWidths<i32, i32, i32>())
    : WidthAliases.encode();
}

export function importedWidth(): string { return JSON.stringify(new Model()); }
