// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";


@json export class Token {
  text: string = "default";


  @deserializer("string") decode(source: string): Token {
    const v = new Token();
    v.text = JSON.parse<string>(source);
    return v;
  }
}
