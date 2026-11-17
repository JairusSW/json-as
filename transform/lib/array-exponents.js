// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { ARRAY_EXPONENT_DATA, STOCK_POWER_SOURCE, } from "./array-exponent-data.js";
export { STOCK_POWER_SOURCE };
let cachedData;
export function stockArrayExponentData(text) {
    if (createHash("sha256").update(text).digest("hex") !== STOCK_POWER_SOURCE)
        return null;
    return (cachedData ??= Buffer.from(ARRAY_EXPONENT_DATA, "base64").toString("utf16le"));
}
