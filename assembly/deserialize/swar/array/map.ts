// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { deserializeGenericArrayBody } from "./generic";
import { ensureArrayField } from "./shared";

export function deserializeMapArrayField<T extends Map<any, any>[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeGenericArrayBody<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}
