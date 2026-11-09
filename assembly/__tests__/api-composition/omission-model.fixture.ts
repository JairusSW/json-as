// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
function shouldOmit(_self: Base): bool {
  return true;
}
const OMIT: bool = true;


@json export class Base {

  @omitif(shouldOmit) value: i32 = 7;
}


@json export class ExpressionBase {

  @omitif("OMIT") value: i32 = 7;
}
