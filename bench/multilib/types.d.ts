// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

declare module "fast-json-parse" {
  export default function parseFast<T = unknown>(
    input: string,
  ): {
    value: T;
    err: Error | null;
  };
}
