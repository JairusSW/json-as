// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bytes } from "./bytes";
export function concat(left: string, right: string): string {
  const leftSize: usize = bytes(left);
  const rightSize: usize = bytes(right);
  const jointSize: usize = leftSize + rightSize;
  const jointPtr = __renew(changetype<usize>(left), jointSize);
  memory.copy(
    changetype<usize>(left) + leftSize,
    changetype<usize>(right),
    rightSize,
  );
  return changetype<string>(jointPtr);
}
