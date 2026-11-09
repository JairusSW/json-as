# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# SPDX-License-Identifier: MPL-2.0
# Copyright (c) 2026 Jairus Tanaka

import ctypes
import errno
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import oracle_storage


class OracleStorageTests(unittest.TestCase):
    def check_independence(self, directory):
        source = Path(directory) / 'source.json'
        destination = Path(directory) / 'copy.json'
        original = b'{"value":"\\ud800","padding":"' + b'x' * 8192 + b'"}'
        source.write_bytes(original)
        oracle_storage.copy_oracle(source, destination)
        self.assertEqual(destination.read_bytes(), original)
        self.assertNotEqual(source.stat().st_ino, destination.stat().st_ino)
        destination.write_bytes(b'{"changed":"destination"}')
        self.assertEqual(source.read_bytes(), original)
        source.write_bytes(b'{"changed":"source"}')
        self.assertEqual(destination.read_bytes(), b'{"changed":"destination"}')

    def test_platform_copy_preserves_bytes_and_write_independence(self):
        with tempfile.TemporaryDirectory() as directory:
            self.check_independence(directory)

    def test_portable_fallback_preserves_bytes_and_write_independence(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(oracle_storage, '_CLONE_FILE', None):
            self.check_independence(directory)

    def test_unsupported_filesystem_falls_back(self):
        def unsupported(*args):
            ctypes.set_errno(errno.ENOTSUP)
            return -1
        with tempfile.TemporaryDirectory() as directory, patch.object(oracle_storage, '_CLONE_FILE', unsupported):
            self.check_independence(directory)

    def test_existing_hardlinked_destination_is_replaced_independently(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source.json'
            destination = Path(directory) / 'copy.json'
            retained = Path(directory) / 'retained.json'
            source.write_bytes(b'{"new":true}')
            destination.write_bytes(b'{"old":true}')
            os.link(destination, retained)
            oracle_storage.copy_oracle(source, destination)
            self.assertEqual(destination.read_bytes(), source.read_bytes())
            self.assertEqual(retained.read_bytes(), b'{"old":true}')

    def test_failed_portable_copy_preserves_existing_output(self):
        def partial(source, destination, **kwargs):
            Path(destination).write_bytes(b'partial')
            raise OSError(errno.ENOSPC, 'Injected full filesystem')
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source.json'
            destination = Path(directory) / 'copy.json'
            source.write_bytes(b'{"new":true}')
            destination.write_bytes(b'{"old":true}')
            with patch.object(oracle_storage, '_CLONE_FILE', None), patch.object(oracle_storage.shutil, 'copyfile', partial):
                with self.assertRaises(OSError) as raised:
                    oracle_storage.copy_oracle(source, destination)
                self.assertEqual(raised.exception.errno, errno.ENOSPC)
            self.assertEqual(destination.read_bytes(), b'{"old":true}')

    def test_storage_error_preserves_existing_output_and_does_not_fall_back(self):
        def full(*args):
            ctypes.set_errno(errno.ENOSPC)
            return -1
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source.json'
            destination = Path(directory) / 'copy.json'
            source.write_bytes(b'{"new":true}')
            destination.write_bytes(b'{"old":true}')
            with patch.object(oracle_storage, '_CLONE_FILE', full), patch.object(oracle_storage.shutil, 'copy2') as fallback:
                with self.assertRaises(OSError) as raised:
                    oracle_storage.copy_oracle(source, destination)
                self.assertEqual(raised.exception.errno, errno.ENOSPC)
                fallback.assert_not_called()
            self.assertEqual(destination.read_bytes(), b'{"old":true}')
            self.assertEqual(sorted(p.name for p in Path(directory).iterdir()), ['copy.json', 'source.json'])


if __name__ == '__main__':
    unittest.main()
