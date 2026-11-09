# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# SPDX-License-Identifier: MPL-2.0
# Copyright (c) 2026 Jairus Tanaka

"""Independent oracle copies, using APFS copy-on-write storage when available."""
import ctypes
import errno
import os
from pathlib import Path
import shutil
import sys
import tempfile

_CLONE_FILE = None
if sys.platform == 'darwin':
    try:
        _CLONE_FILE = ctypes.CDLL(None, use_errno=True).clonefile
        _CLONE_FILE.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int]
        _CLONE_FILE.restype = ctypes.c_int
    except AttributeError:
        pass

_UNSUPPORTED = {errno.ENOSYS, errno.EINVAL, errno.EXDEV, errno.ENOTSUP, errno.EOPNOTSUPP}


def copy_oracle(source, destination):
    """Atomically replace destination without sharing a writable inode.

    Copies run after timing. Clones preserve the complete output bytes while
    letting later producer writes leave captured comparison evidence intact.
    Unsupported platforms/filesystems retain the ordinary copy behavior.
    """
    source, destination = Path(source), Path(destination)
    with tempfile.TemporaryDirectory(prefix='.oracle-copy-', dir=destination.parent) as directory:
        temporary = Path(directory) / 'output'
        cloned = False
        if _CLONE_FILE is not None:
            if _CLONE_FILE(os.fsencode(source), os.fsencode(temporary), 0) == 0:
                cloned = True
            else:
                code = ctypes.get_errno()
                if code not in _UNSUPPORTED:
                    raise OSError(code, os.strerror(code), str(source))
        if cloned:
            shutil.copystat(source, temporary)
        else:
            shutil.copy2(source, temporary)
        os.replace(temporary, destination)
