// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { State as StateAlias } from "./composition-enum.fixture";


@json class ScalarSpellings {
  value: number = 0;
  signed: isize = 0;
  unsigned: usize = 0;
}


@json class CastDefault {
  value: i32 = <i8>257;
}


@json class EnumImport {
  value: StateAlias = StateAlias.Off;
}
const scalar = new ScalarSpellings();
const cast = new CastDefault();
const enumValue = new EnumImport();
export function allocInput(bytes: i32): string {
  return changetype<string>(__new(bytes, idof<string>()));
}
export function run(source: string, kind: i32, reuse: bool): string {
  if (kind == 0)
    return JSON.stringify(
      JSON.parse<ScalarSpellings>(
        source,
        reuse ? scalar : changetype<ScalarSpellings>(0),
      ),
    );
  if (kind == 1)
    return JSON.stringify(
      JSON.parse<CastDefault>(
        source,
        reuse ? cast : changetype<CastDefault>(0),
      ),
    );
  return JSON.stringify(
    JSON.parse<EnumImport>(
      source,
      reuse ? enumValue : changetype<EnumImport>(0),
    ),
  );
}
