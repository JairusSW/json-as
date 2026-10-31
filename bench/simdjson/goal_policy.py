"""One-sided native latency target; other modes are diagnostic."""
import math


def target_status(mode, candidate_ns, native_ns, target):
    if mode != target['mode']:
        return None
    if not all(math.isfinite(value) and value > 0 for value in (candidate_ns, native_ns)):
        return False
    return candidate_ns <= native_ns * target['maxLatencyRatio']
