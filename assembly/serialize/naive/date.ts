// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { bs } from "../../../lib/as-bs";
import { QUOTE } from "../../custom/chars";
import { bytes } from "../../util/bytes";

export function serializeDate(src: Date): void {
  const data = src.toISOString();
  const dataSize = bytes(data);
  bs.proposeSize(dataSize + 4);
  store<u16>(bs.offset, QUOTE);
  memory.copy(bs.offset + 2, changetype<usize>(data), dataSize);
  store<u16>(bs.offset + dataSize, QUOTE, 2);
  bs.offset += dataSize + 4;
}
