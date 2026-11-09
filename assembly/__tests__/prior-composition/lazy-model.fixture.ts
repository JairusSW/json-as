// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
export let calls: i32 = 0;

@json class Codec {
  value: i32 = 7;

  @deserializer("object") decode(_source: string): Codec {
    calls++;
    return new Codec();
  }
}
export type PublicLazy = JSON.Lazy<Codec>;
export function make(): PublicLazy {
  return new Codec();
}
