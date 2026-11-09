# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# SPDX-License-Identifier: MPL-2.0
# Copyright (c) 2026 Jairus Tanaka

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
CHECKER = ROOT / 'bench/simdjson/check-oracles.py'
COMPARISON = ROOT / 'bench/simdjson/compare.py'
SUFFIXES = [*(f'.{i}.json' for i in range(4)),
            *(f'.retained-object.{i}.json' for i in range(8)),
            *(f'.retained-string.{i}.json' for i in range(8))]


class OwnedSelectionTests(unittest.TestCase):
    def fixture(self, directory, modes):
        for index, suffix in enumerate(SUFFIXES):
            data = json.dumps({'slot': index, 'exact': 9007199254740993,
                               'flag': True, 'nested': ['中', {'value': index}]})
            (Path(directory) / ('native-example' + suffix)).write_text(data)
            for mode in modes:
                (Path(directory) / ('as-' + mode + '-example' + suffix)).write_text(data)

    def run_checker(self, directory, *options):
        return subprocess.run([sys.executable, str(CHECKER), directory, 'example', *options],
                              text=True, capture_output=True)

    def test_simd_only_checks_all_twenty_owned_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            self.fixture(directory, ['simd'])
            result = self.run_checker(directory, '--modes', 'simd')
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            evidence = json.loads((Path(directory) / 'example.evidence.json').read_text())
            self.assertEqual(len(evidence), 20)
            self.assertTrue(all(name.startswith('as-simd-') for name in evidence))

    def test_default_still_requires_both_modes_and_checks_forty_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            self.fixture(directory, ['simd'])
            self.assertNotEqual(self.run_checker(directory).returncode, 0)
            self.fixture(directory, ['swar', 'simd'])
            result = self.run_checker(directory)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(len(json.loads((Path(directory) / 'example.evidence.json').read_text())), 40)

    def test_last_retained_string_and_exact_integer_cannot_be_skipped(self):
        with tempfile.TemporaryDirectory() as directory:
            self.fixture(directory, ['simd'])
            target = Path(directory) / 'as-simd-example.retained-string.7.json'
            data = json.loads(target.read_text())
            data['exact'] -= 1
            target.write_text(json.dumps(data))
            result = self.run_checker(directory, '--modes', 'simd')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('retained-string.7', result.stdout + result.stderr)

    def test_boolean_is_not_a_numeric_match(self):
        with tempfile.TemporaryDirectory() as directory:
            self.fixture(directory, ['simd'])
            target = Path(directory) / 'as-simd-example.retained-object.7.json'
            data = json.loads(target.read_text())
            data['flag'] = 1
            target.write_text(json.dumps(data))
            self.assertNotEqual(self.run_checker(directory, '--modes', 'simd').returncode, 0)

    def test_duplicate_mode_cannot_inflate_comparison_count(self):
        with tempfile.TemporaryDirectory() as directory:
            self.fixture(directory, ['simd'])
            result = self.run_checker(directory, '--modes', 'simd,simd')
            self.assertEqual(result.returncode, 2)
            self.assertIn('distinct', result.stderr)


class GateSelectionTests(unittest.TestCase):
    def reject(self, options, message):
        result = subprocess.run([sys.executable, str(COMPARISON), '--labels', 'unbuilt-selection-test',
                                 '--output', 'selection-test-no-artifacts', *options],
                                cwd=ROOT, text=True, capture_output=True)
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn(message, result.stderr)

    def test_classic_gate_cannot_use_swar_only(self):
        self.reject(['--modes', 'swar', '--gate-classic', 'v8'], 'must measure target mode simd')

    def test_validation_gate_cannot_use_swar_only(self):
        self.reject(['--modes', 'swar', '--gate-validation', 'v8'], 'must measure target mode simd')

    def test_regression_gate_requires_two_revisions(self):
        self.reject(['--modes', 'simd', '--gate-regression', '3'], 'requires at least two labels')

    def test_invalid_measurement_modes_are_rejected(self):
        for modes in ['', 'simd,simd', 'unknown']:
            with self.subTest(modes=modes):
                self.reject(['--modes', modes], 'Modes must be distinct')


if __name__ == '__main__':
    unittest.main()
