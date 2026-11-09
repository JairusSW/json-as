// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// Malformed-range failures are recorded only on the cold error path and
// consumed at a public JSON.parse boundary. Keeping the final throw there
// makes it catchable by try-as without adding a success-path store or a
// second validation scan.
let productionParseError = false;

export function markProductionParseError(): void {
  productionParseError = true;
}

export function takeProductionParseError(): bool {
  if (!productionParseError) return false;
  productionParseError = false;
  return true;
}

/** Mark a malformed cold path and return the shared zero cursor sentinel. */
export function failProductionParse(): usize {
  productionParseError = true;
  return 0;
}
