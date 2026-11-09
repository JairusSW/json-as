# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# SPDX-License-Identifier: MPL-2.0
# Copyright (c) 2026 Jairus Tanaka

import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('model_oracle', Path(__file__).with_name('check-model.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class ModelOracle(unittest.TestCase):
    def test_fields_defaults_and_wide_numbers(self):
        classes = {'Root': [dict(key='n', type='u64', optional=False), dict(key='child', type='Root|null', optional=True)]}
        expected = m.expected({'n': 9007199254740993}, 'Root', classes)
        self.assertEqual(expected, {'n': 9007199254740993, 'child': None})
        m.compare(expected, expected)
        for wrong in ({'n': 9007199254740992, 'child': None}, {'n': 9007199254740993}, {'n': 9007199254740993, 'child': 0}):
            with self.assertRaises(AssertionError):
                m.compare(expected, wrong)
        with self.assertRaises(AssertionError):
            m.expected({'n': 1, 'unmodeled': 2}, 'Root', classes)
        self.assertEqual(m.expected({}, 'Root', classes), {'n': 0, 'child': None})

    def test_omitted_optional_class_has_complete_default_graph(self):
        classes = {'Child': [dict(key='n', type='i64', optional=False), dict(key='a', type='string[]', optional=False)], 'Root': [dict(key='child', type='Child', optional=True)]}
        self.assertEqual(m.expected({}, 'Root', classes), {'child': {'n': 0, 'a': []}})

    def test_bool_is_not_numeric_and_container_contents_are_checked(self):
        with self.assertRaises(AssertionError):
            m.compare({'a': [True]}, {'a': [1]})
        with self.assertRaises(AssertionError):
            m.compare({'a': [1, 2]}, {'a': [1, 3]})
        m.compare(m.expected({'x': [1, 2]}, 'Map<string,i32[]>', {}), {'x': [1, 2]})

if __name__ == '__main__':
    unittest.main()
