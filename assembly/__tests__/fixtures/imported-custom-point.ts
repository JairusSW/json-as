// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";


@json
export class ImportedCustomPoint {
  x: f64 = 0.0;
  y: f64 = 0.0;

  constructor(x: f64 = 0.0, y: f64 = 0.0) {
    this.x = x;
    this.y = y;
  }


  @serializer("string")
  serializer(self: ImportedCustomPoint): string {
    return JSON.stringify(`${self.x},${self.y}`);
  }


  @deserializer("string")
  deserializer(data: string): ImportedCustomPoint {
    const raw = JSON.parse<string>(data);
    const separator = raw.indexOf(",");
    if (separator < 0) throw new Error("Invalid imported custom point");
    return new ImportedCustomPoint(
      f64.parse(raw.slice(0, separator)),
      f64.parse(raw.slice(separator + 1)),
    );
  }
}
