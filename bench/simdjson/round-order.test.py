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

    def test_single_revision_simd_qualification_balances_native_order(self):
        native_positions = collections.Counter()
        expected = {('native', 'native', 'native'), ('current', 'simd', 'w2c2-default')}
        for pair in range(6):
            schedule = round_schedule(['current'], ['w2c2-default'], pair, ['simd'])
            self.assertEqual(set(schedule), expected)
            self.assertEqual(len(schedule), 2)
            native_positions[schedule.index(('native', 'native', 'native'))] += 1
        self.assertEqual(native_positions, {0: 3, 1: 3})

    def test_selected_modes_cover_every_revision_and_backend(self):
        labels = ['baseline', 'candidate']
        backends = ['v8', 'w2c2-default']
        for modes in [['simd'], ['swar'], ['simd', 'swar']]:
            expected = [('native', 'native', 'native')] + [
                (label, mode, backend)
                for label in labels for backend in backends for mode in modes
            ]
            for pair in range(6):
                schedule = round_schedule(labels, backends, pair, modes)
                self.assertEqual(collections.Counter(schedule), collections.Counter(expected))
                if pair % 2:
                    self.assertEqual(schedule, list(reversed(round_schedule(labels, backends, pair - 1, modes))))


if __name__ == '__main__':
    unittest.main()
