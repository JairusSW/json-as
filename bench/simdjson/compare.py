"""Compare frozen parser/runtime variants without overlapping build or oracle jobs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import statistics
import subprocess

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'build/simdjson-parity'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--labels', required=True, help='Comma-separated built labels; first is baseline')
parser.add_argument('--case', default='canada-min')
parser.add_argument('--pairs', type=int, default=5)
parser.add_argument('--output', required=True)
parser.add_argument('--backends', default='v8', help='v8,w2c2-checked,w2c2-default')
parser.add_argument('--allow-w2c2-source-change', action='store_true', help='Backend experiment: permit different pinned w2c2 revisions, retaining compiler/translator/SIMDe checks')
parser.add_argument('--smoke', action='store_true', help='One diagnostic round; no performance gate')
parser.add_argument('--gate-validation', choices=['v8','w2c2-checked','w2c2-default'])
parser.add_argument('--gate-regression', type=float, help='Fail if candidate median regresses beyond this percent')
args = parser.parse_args()
labels = args.labels.split(',')
backends = args.backends.split(',')
if set(backends) - {'v8', 'w2c2-checked', 'w2c2-default'} or len(set(backends)) != len(backends):
    parser.error('Invalid backend list')
if len(set(labels)) < 2 or len(set(labels)) != len(labels) or (args.pairs < 5 and not (args.smoke and args.pairs == 1)):
    parser.error('Use at least two distinct labels and five process pairs')
for name in [*labels, args.case, args.output]:
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', name):
        parser.error('Invalid artifact name')
output = BASE / 'comparisons' / args.output
if output.exists():
    parser.error('Output already exists; choose a new label to preserve evidence')
metadata = {label: json.loads((BASE / f'runs/{label}/generated/{args.case}.json').read_text()) for label in labels}

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def binary(label, engine):
    return BASE / f'runs/{label}/{args.case}-{engine}{"" if engine == "native" else ".wasm"}'

backend_metadata = {}
def backend_binary(label, engine, backend):
    check = 1 if backend == 'w2c2-checked' else 0
    return BASE / f'runs/{label}/w2c2/{args.case}-{engine}/checks-{check}'

baseline = metadata[labels[0]]
if args.gate_regression is not None and (args.smoke or not 0 <= args.gate_regression < 100):
    parser.error('Regression gate needs five pairs and a percentage from 0 to 100')
if args.gate_validation:
    if args.smoke or not baseline.get('validationOnly') or args.gate_validation not in backends:
        parser.error('Validation gate needs the full matrix, five pairs, and a measured backend')
    manifest = json.loads((ROOT / 'bench/simdjson/workloads.json').read_text())
    required = {f'validate/{c["name"]}-{layout}' for c in manifest['corpora'] for layout in c['layouts']}
    if set(baseline['phases']) != required:
        raise ValueError('Validation matrix coverage is incomplete')
for label, meta in metadata.items():
    for field in ['ops', 'schemaSha256', 'root', 'simdjson', 'phases', 'toolchain']:
        if meta[field] != baseline[field]:
            raise ValueError(f'{label}: {field} differs')
    if [item['sha256'] for item in meta['inputs']] != [item['sha256'] for item in baseline['inputs']]:
        raise ValueError(f'{label}: input contents differ')
    for item in meta['inputs']:
        if sha(ROOT / item['path']) != item['sha256']:
            raise ValueError(f'{label}: input changed')
    for engine in ['native', 'swar', 'simd']:
        if sha(binary(label, engine)) != meta['binaries'][engine]['sha256']:
            raise ValueError(f'{label}: {engine} binary changed')
    if meta['binaries']['native']['sha256'] != baseline['binaries']['native']['sha256']:
        raise ValueError(f'{label}: native executable differs')
for label in labels:
    for backend in backends:
        if backend == 'v8':
            continue
        for mode in ['swar', 'simd']:
            artifact = backend_binary(label, mode, backend)
            meta = json.loads(artifact.with_suffix('.json').read_text())
            if sha(artifact) != meta['binarySha256'] or sha(binary(label, mode)) != meta['wasmSha256']:
                raise ValueError('w2c2 artifact or its source Wasm changed')
            if meta['runtimeChecks'] != (1 if backend == 'w2c2-checked' else 0):
                raise ValueError('Unexpected runtime-check policy')
            if '-ffp-contract=off' not in meta['command']:
                raise ValueError('w2c2 C compiler must preserve separate Wasm floating operations')
            if backend_metadata:
                reference = next(iter(backend_metadata.values()))
                for field in ['w2c2', 'translatorSha256', 'simde', 'compiler', 'hostSha256']:
                    if field == 'w2c2' and args.allow_w2c2_source_change:
                        continue
                    if meta[field] != reference[field]:
                        raise ValueError(f'w2c2 backend provenance differs: {field}')
            backend_metadata[f'{label}/{backend}/{mode}'] = meta
output.mkdir(parents=True)
for label in labels:
    for backend in backends:
        (output / f'oracles/{backend}/{label}').mkdir(parents=True)
(output / 'backends.json').write_text(json.dumps(backend_metadata, indent=2) + '\n')
(output / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
rows = []
for pair in range(args.pairs):
    ordered = labels[pair % len(labels):] + labels[:pair % len(labels)]
    backend_order = backends[pair % len(backends):] + backends[:pair % len(backends)]
    schedule = [('native', 'native', 'native')] + [(label, mode, backend) for label in ordered for backend in backend_order for mode in ['swar', 'simd']]
    if pair % 2:
        schedule.reverse()
    for label, engine, backend in schedule:
        print(f'Run {pair + 1}/{args.pairs}: {label}/{backend}/{engine}', flush=True)
        if engine == 'native':
            source = BASE / f'runs/{labels[0]}'
            command = [str(binary(labels[0], 'native')), str(source / ('inputs' if baseline.get('validationOnly') else f'inputs/{args.case}')), str(baseline['ops']), str(source / f'oracles/native-{args.case}')]
        elif backend != 'v8':
            command = [str(backend_binary(label, engine, backend))]
        else:
            command = ['v8', '--no-liftoff', '--module', 'bench/runners/assemblyscript.js', '--', str(binary(label, engine).relative_to(ROOT / 'build'))]
        result = subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env={**os.environ, 'W2C2_ORACLE_DIR': str(output / f'oracles/{backend}/{label}')})
        (output / f'{pair}-{label}-{backend}-{engine}.log').write_text(result.stdout)
        if result.returncode or 'abort:' in result.stdout:
            raise RuntimeError(result.stdout)
        if engine == 'native':
            phases = [json.loads(line[7:]) for line in result.stdout.splitlines() if line.startswith('PARITY ')]
        else:
            phases = [{'phase': phase, 'ns': float(ns.replace(',', '')) * {'ns': 1, 'us': 1000, 'ms': 1000000}[unit]} for phase, ns, unit in re.findall(r'Benchmarking ([^\n]+)\n.*?\(([\d,.]+) (ns|us|ms)/op\)', result.stdout, re.S)]
        if sorted(row['phase'] for row in phases) != sorted(baseline['phases']):
            raise ValueError('Missing or unexpected phases')
        rows.extend({**row, 'label': label, 'engine': engine, 'backend': backend, 'pair': pair} for row in phases)
        (output / 'results.json').write_text(json.dumps(rows, indent=2) + '\n')
# Decode full results only after every timing process is finished.
for label in labels:
    for backend in backends:
        oracles = output / f'oracles/{backend}/{label}'
        if backend == 'v8':
            for file in (BASE / f'runs/{label}/oracles').glob(f'as-*-{args.case}*.json'):
                shutil.copy2(file, oracles / file.name)
        for file in (BASE / f'runs/{labels[0]}/oracles').glob(f'native-{args.case}*.json'):
            shutil.copy2(file, oracles / file.name)
        if baseline.get('validationOnly'):
            native = json.loads((oracles / f'native-{args.case}.json').read_text())
            if native != baseline['expectedOracle']:
                raise ValueError('Native preflight/input coverage differs')
            for mode in ['swar', 'simd']:
                actual = json.loads((oracles / f'as-{mode}-{args.case}.json').read_text())
                if actual != native:
                    raise ValueError(f'Validation oracle differs: {label}/{backend}/{mode}')
            print(f'Validation oracle passed: {label}/{backend}, {native}', flush=True)
        else:
            subprocess.run(['python3', 'bench/simdjson/check-oracles.py', str(oracles), args.case], cwd=ROOT, check=True)


def median(label, engine, phase, backend):
    return statistics.median(row['ns'] for row in rows if row['label'] == label and row['engine'] == engine and row['phase'] == phase and row['backend'] == backend)

lines = ['label\tbackend\tmode\tphase\tnative ns\tjson-as ns\tnative/json-as\tbaseline/json-as']
for label in labels:
    for backend in backends:
        for mode in ['swar', 'simd']:
            for phase in baseline['phases']:
                value = median(label, mode, phase, backend)
                native = median('native', 'native', phase, 'native')
                control = median(labels[0], mode, phase, backend)
                lines.append(f'{label}\t{backend}\t{mode}\t{phase}\t{native:.2f}\t{value:.2f}\t{native/value:.3f}\t{control/value:.3f}')
(output / 'results.tsv').write_text('\n'.join(lines) + '\n')
print('\n'.join(lines))
print('Diagnostic variant comparison; whole-matrix parity remains a separate gate.')
print('w2c2-default disables Wasm runtime bounds/table checks; report separately from checked execution.')

exit_status = 0
if args.gate_validation:
    candidate = labels[-1]
    gaps = [(mode, phase) for mode in ['swar','simd'] for phase in baseline['phases']
            if median(candidate,mode,phase,args.gate_validation) > median('native','native',phase,'native')]
    print(f'Validation family gate: {len(gaps)} gaps across {len(baseline["phases"])} layouts and two modes')
    print('All other required workload families remain separate; this is not a whole-goal pass.')
    exit_status = 1 if gaps else 0

if args.gate_regression is not None:
    candidate = labels[-1]
    regressions = [(backend,mode,phase) for backend in backends for mode in ['swar','simd'] for phase in baseline['phases']
                   if median(candidate,mode,phase,backend) > median(labels[0],mode,phase,backend)*(1+args.gate_regression/100)]
    print(f'Regression screen: {len(regressions)} rows exceed {args.gate_regression}% tolerance')
    for row in regressions: print('REGRESSION', '/'.join(row))
    print('This screen is not a native parity or coverage verdict.')
    exit_status = max(exit_status, 1 if regressions else 0)
if args.gate_validation or args.gate_regression is not None:
    raise SystemExit(exit_status)
