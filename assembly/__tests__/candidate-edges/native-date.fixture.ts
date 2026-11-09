// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../../index";
import { Date as ModelDate } from "./date.fixture";

@json
class Both {
  native: Date = new Date(0);
  model: ModelDate = new ModelDate();
}
export function run(): string {
  const out = JSON.parse<Both>(
    '{"native":"1970-01-02T00:00:00.000Z","model":{"value":7}}',
  );
  return out.native.getTime().toString() + ":" + out.model.value.toString();
}
