// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { PublicToken as Token, make } from "./codec-model.fixture";

@json class Owner {
  value: Token = make();
}
export function run(reuse: bool): string {
  assert(JSON.stringify(JSON.parse<Token>("7")) == "7");
  return JSON.stringify(
    JSON.parse<Owner>(
      '{"value":7}',
      reuse ? new Owner() : changetype<Owner>(0),
    ),
  );
}
