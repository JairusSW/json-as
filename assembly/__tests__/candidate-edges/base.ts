// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

function omitted(_self: Base): bool {
  return true;
}
const OMIT: bool = true;
export class Base {

  @omitif(omitted) value: i32 = 7;


  @omitif("OMIT") count: i32 = 8;
}

export class ArrowBase {

  @omitif((self) => self.hidden == 7) hidden: i32 = 7;

  @omitif(() => true) zero: i32 = 8;

  @omitif('this.label == "skip"') label: string = "skip";
}
