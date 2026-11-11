// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import * as Runtime from "../index";

@json
class Record {
  id: i32 = 0;
  ignored: string = "";
}

export function read(): i32 {
  const value = Runtime.JSON.parse<Record>('{"id":7,"ignored":"text"}');
  return value.id;
}
