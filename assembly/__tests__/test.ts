// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";


@json
class Data {
  id: string = "";
  active: bool = false;
}

export function test(): void {
  const d = new Data();
  d.id = "second";
  d.active = true;
  const result = JSON.stringify<Data>(d);
  assert(
    result == '{"id":"second","active":true}',
    "Serialization B failed: " + result,
  );
}
