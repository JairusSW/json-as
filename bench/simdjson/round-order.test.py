import collections
import unittest

from round_order import round_schedule


class ComparisonOrderTests(unittest.TestCase):
    def test_consecutive_rounds_reverse_every_process(self):
        for labels in [['baseline', 'candidate'], ['baseline', 'middle', 'candidate']]:
            backends = ['v8', 'w2c2-checked', 'w2c2-default']
            for pair in range(0, 12, 2):
                self.assertEqual(
                    round_schedule(labels, backends, pair + 1),
                    list(reversed(round_schedule(labels, backends, pair))),
                )

    def test_every_round_covers_each_variant_backend_mode_once(self):
        labels = ['baseline', 'middle', 'candidate']
        backends = ['v8', 'w2c2-checked', 'w2c2-default']
        expected = [('native', 'native', 'native')] + [
            (label, mode, backend)
            for label in labels for backend in backends for mode in ['swar', 'simd']
        ]
        for pair in range(12):
            self.assertEqual(collections.Counter(round_schedule(labels, backends, pair)), collections.Counter(expected))

    def test_two_variants_have_equal_first_position_counts(self):
        counts = collections.Counter()
        for pair in range(12):
            schedule = round_schedule(['baseline', 'candidate'], ['v8'], pair)
            first = next(label for label, _, _ in schedule if label != 'native')
            counts[first] += 1
        self.assertEqual(counts, {'baseline': 6, 'candidate': 6})

    def test_three_variants_and_backends_cycle_through_every_order(self):
        labels = ['baseline', 'middle', 'candidate']
        backends = ['v8', 'w2c2-checked', 'w2c2-default']
        label_orders, backend_orders = set(), set()
        for pair in range(6):
            schedule = [entry for entry in round_schedule(labels, backends, pair) if entry[0] != 'native']
            label_orders.add(tuple(dict.fromkeys(label for label, _, _ in schedule)))
            backend_orders.add(tuple(dict.fromkeys(backend for label, _, backend in schedule if label == 'baseline')))
        self.assertEqual(len(label_orders), 6)
        self.assertEqual(len(backend_orders), 6)


if __name__ == '__main__':
    unittest.main()
