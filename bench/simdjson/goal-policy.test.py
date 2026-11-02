import unittest

from goal_policy import target_status


class NativeTargetTests(unittest.TestCase):
    target = {'mode': 'simd', 'maxLatencyRatio': 1.2}

    def test_twenty_percent_latency_boundary(self):
        self.assertTrue(target_status('simd', 120, 100, self.target))
        self.assertFalse(target_status('simd', 120.001, 100, self.target))

    def test_faster_has_no_upper_limit(self):
        self.assertTrue(target_status('simd', 80, 100, self.target))
        self.assertTrue(target_status('simd', 1, 100, self.target))

    def test_swar_does_not_gate_native_target(self):
        self.assertIsNone(target_status('swar', 1000, 100, self.target))

    def test_invalid_measurements_cannot_pass(self):
        for value in (0, -1, float('inf'), float('nan')):
            self.assertFalse(target_status('simd', value, 100, self.target))
            self.assertFalse(target_status('simd', 100, value, self.target))


if __name__ == '__main__':
    unittest.main()
