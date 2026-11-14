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
  title: string = "";
  flag: bool = false;
}

export function read(input: string): string {
  const value = JSON.parse<Record>(input);
  return value.id.toString() + value.title + value.flag.toString();
}


@json({ nolazy })
class BenchmarkRecord {
  id: i32 = 0;
  unread: string = "";
}
export function readEager(input: string): i32 {
  return JSON.parse<BenchmarkRecord>(input).id;
}
