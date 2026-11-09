// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bs } from "../../../lib/as-bs";
import { JSON } from "../..";
import { bytes } from "../../util";

/**
 * Serialize raw data to itself
 * @param data data to serialize
 * @returns void
 */
export function serializeRaw(data: JSON.Raw): void {
  const dataSize = bytes(data.data);
  bs.proposeSize(dataSize);
  memory.copy(
    changetype<usize>(bs.offset),
    changetype<usize>(data.data),
    dataSize,
  );
  bs.offset += dataSize;
}
