// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { validateCursor } from "../../deserialize/cursor";
import { normalizeJSONEncoding, validateJSON } from "../../util/validateJson";

export function legacy(source: string): bool {
  return validateJSON(normalizeJSONEncoding(source));
}
export function cursor(source: string): bool {
  return validateCursor(normalizeJSONEncoding(source));
}
