# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# SPDX-License-Identifier: MPL-2.0
# Copyright (c) 2026 Jairus Tanaka

"""One-sided native latency target; other modes are diagnostic."""
import math


def target_status(mode, candidate_ns, native_ns, target):
    if mode != target['mode']:
        return None
    if not all(math.isfinite(value) and value > 0 for value in (candidate_ns, native_ns)):
        return False
    return candidate_ns <= native_ns * target['maxLatencyRatio']
