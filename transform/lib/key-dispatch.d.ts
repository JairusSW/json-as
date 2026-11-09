// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

export type KeyDispatch<T> = {
    members: T[];
} | {
    offset: number;
    pivot: number;
    left: KeyDispatch<T>;
    right: KeyDispatch<T>;
};
export declare function keyDispatch<T>(members: T[], key: (member: T) => string): KeyDispatch<T>;
