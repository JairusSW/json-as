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
