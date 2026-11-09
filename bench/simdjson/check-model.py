# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# SPDX-License-Identifier: MPL-2.0
# Copyright (c) 2026 Jairus Tanaka

"""Check owning model output against every source value and declared default.

Python's JSON decoder retains wide integers. Unlike a DOM equality check this
also accounts for @optional fields emitted from the native struct defaults.
"""
import json
import re
import struct
import sys


def arguments(text):
    depth, start, result = 0, 0, []
    for i, ch in enumerate(text):
        depth += (ch == '<') - (ch == '>')
        if ch == ',' and depth == 0:
            result.append(text[start:i])
            start = i + 1
    return result + [text[start:]]


def expected(value, kind, classes, missing=False):
    kind = re.sub(r'\s', '', kind)
    if kind.endswith('|null'):
        return None if missing or value is None else expected(value, kind[:-5], classes)
    if kind.endswith('[]'):
        return [] if missing else [expected(v, kind[:-2], classes) for v in value]
    match = re.fullmatch(r'([\w.]+)<(.*)>', kind)
    if match:
        name, body = match.groups()
        args = arguments(body)
        if name in ('Array', 'StaticArray'):
            return [] if missing else [expected(v, args[0], classes) for v in value]
        if name == 'Map':
            assert args[0] == 'string', kind
            return {} if missing else {k: expected(v, args[1], classes) for k, v in value.items()}
        if name == 'JSON.Box':
            return expected(value, args[0], classes, missing)
        raise AssertionError(kind)
    if kind in classes:
        if missing:
            value = {}
        assert isinstance(value, dict), f'Expected {kind} object'
        fields = classes[kind]
        assert set(value) <= {f['key'] for f in fields}, f'Unmodeled source keys: {kind}'
        result = {}
        for field in fields:
            absent = field['key'] not in value
            assert not absent or field.get('initializer') is None, f'Unsupported omitted explicit default: {kind}.{field["key"]}'
            result[field['key']] = expected(value.get(field['key']), field['type'], classes, absent)
        return result
    if missing:
        if kind in ('bool', 'boolean'):
            return False
        if kind == 'string':
            return ''
        if kind == 'JSON.Raw':
            return None
        return 0
    if kind == 'f32':
        return struct.unpack('f', struct.pack('f', value))[0]
    return value


def compare(left, right, location='$'):
    if isinstance(left, dict) and isinstance(right, dict):
        assert left.keys() == right.keys(), f'{location}: keys differ'
        for key in left:
            compare(left[key], right[key], location + '.' + key)
    elif isinstance(left, list) and isinstance(right, list):
        assert len(left) == len(right), f'{location}: lengths differ'
        for i, (a, b) in enumerate(zip(left, right)):
            compare(a, b, location + f'[{i}]')
    else:
        assert (type(left) is bool) == (type(right) is bool), location
        assert left == right, f'{location}: {left!r} != {right!r}'


if __name__ == '__main__':
    source, output, schema = (json.load(open(p)) for p in sys.argv[1:])
    classes = {c['name']: c['fields'] for c in schema['classes']}
    compare(expected(source, schema['root'], classes), output)
    print('Complete owning model oracle passed')
