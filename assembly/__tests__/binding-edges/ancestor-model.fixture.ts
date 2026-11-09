// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
function text(): string {
  return "seed";
}
function omitted(_self: Base): bool {
  return true;
}

@json export class Base {

  @alias("wire") value: JSON.Lazy<string> = text();

  @omitif(omitted) ignored: i32 = 7;
}
export class Middle extends Base {
  middle: i32 = 3;
}
