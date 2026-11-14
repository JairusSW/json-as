// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { PublicState as State, make } from "./enum-model.fixture";


@json class Owner {
  value: State = make();
}
export function run(reuse: bool): string {
  return JSON.stringify(
    JSON.parse<Owner>(
      '{"value":1}',
      reuse ? new Owner() : changetype<Owner>(0),
    ),
  );
}
