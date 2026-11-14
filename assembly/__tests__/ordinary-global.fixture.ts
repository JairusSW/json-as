// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../index";


@json
class GlobalRecord {
  id: i32 = 0;
  body: string = "";
}

export const globalRecord = JSON.parse<GlobalRecord>(
  '{"id":42,"body":"hello"}',
);
