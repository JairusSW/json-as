# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# SPDX-License-Identifier: MPL-2.0
# Copyright (c) 2026 Jairus Tanaka

"""Translate frozen benchmark Wasm and compile an independent w2c2 backend."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'build/simdjson-parity'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--label', required=True)
parser.add_argument('--case', default='canada-min')
parser.add_argument('--checks', default='0,1', help='Comma-separated W2C2_RUNTIME_CHECKS variants')
parser.add_argument('--source', type=Path, default=BASE / 'w2c2')
parser.add_argument('--translator', type=Path, default=BASE / 'w2c2-host/w2c2')
parser.add_argument('--simde', type=Path, default=BASE / 'simde')
args = parser.parse_args()
for name in [args.label, args.case]:
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', name):
        parser.error('Invalid artifact name')
checks = [int(value) for value in args.checks.split(',')]
if set(checks) - {0, 1} or len(checks) != len(set(checks)):
    parser.error('Checks must be distinct values from 0,1')
run = BASE / f'runs/{args.label}'
metadata = json.loads((run / f'generated/{args.case}.json').read_text())
compiler = os.environ.get('W2C2_CC', '/opt/homebrew/bin/gcc-16')
host = ROOT / 'bench/simdjson/w2c2-host.c'

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def invoke(command, log=None):
    result = subprocess.run([str(value) for value in command], cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if log:
        log.write_text(result.stdout)
    if result.returncode:
        raise RuntimeError(result.stdout)
    return result.stdout.strip()

revision = invoke(['git', '-C', args.source, 'rev-parse', 'HEAD'])
if invoke(['git', '-C', args.source, 'status', '--porcelain', '--untracked-files=no']):
    raise ValueError('w2c2 tracked sources are modified')
provenance = {
    'w2c2': revision,
    'translatorSha256': sha(args.translator),
    'simde': invoke(['git', '-C', args.simde, 'rev-parse', 'HEAD']),
    'compiler': invoke([compiler, '--version']),
    'hostSha256': sha(host),
}
for mode in ['swar', 'simd']:
    wasm = run / f'{args.case}-{mode}.wasm'
    if sha(wasm) != metadata['binaries'][mode]['sha256']:
        raise ValueError('Frozen Wasm binary changed')
    directory = run / f'w2c2/{args.case}-{mode}'
    directory.mkdir(parents=True, exist_ok=True)
    shutil.copy2(wasm, directory / 'parity.wasm')
    translation = [args.translator, directory / 'parity.wasm', directory / 'parity.c']
    invoke(translation, directory / 'translate.log')
    for check in checks:
        print(f'Compile {args.label}/{args.case}/{mode}, runtime checks={check}', flush=True)
        binary = directory / f'checks-{check}'
        command = [compiler, '-O3', '-DNDEBUG', '-mcpu=native', '-ffp-contract=off', '-std=gnu11', f'-DW2C2_RUNTIME_CHECKS={check}', '-DW2C2_SIMDE_HEADER="simde/wasm/simd128.h"', f'-I{args.simde}', f'-I{args.source / "w2c2"}', f'-I{directory}', directory / 'parity.c', host, '-lm', '-o', binary]
        invoke(command, directory / f'build-{check}.log')
        evidence = {**provenance, 'runtimeChecks': check, 'wasmSha256': sha(wasm), 'sourceSha256': sha(directory / 'parity.c'), 'headerSha256': sha(directory / 'parity.h'), 'command': [str(value) for value in command], 'translation': [str(value) for value in translation], 'binarySha256': sha(binary), 'bytes': binary.stat().st_size}
        (directory / f'checks-{check}.json').write_text(json.dumps(evidence, indent=2) + '\n')
