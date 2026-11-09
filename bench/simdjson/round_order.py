# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# SPDX-License-Identifier: MPL-2.0
# Copyright (c) 2026 Jairus Tanaka

"""Fresh-process comparison order, including a separately measured native run."""


def round_schedule(labels, backends, pair, modes=('swar', 'simd')):
    # A rotation per round cancels the subsequent reversal for two labels,
    # accidentally running the baseline first every time. Rotate once per
    # forward/reverse pair, so each adjacent pair balances every process.
    offset = (pair // 2) % len(labels)
    ordered = labels[offset:] + labels[:offset]
    offset = (pair // 2) % len(backends)
    backend_order = backends[offset:] + backends[:offset]
    schedule = [('native', 'native', 'native')] + [
        (label, mode, backend)
        for label in ordered
        for backend in backend_order
        for mode in modes
    ]
    return list(reversed(schedule)) if pair % 2 else schedule
