"""Verify the C host ABI, UTF-8 output and memory growth independently of JSON."""
from pathlib import Path
import json
import os
import subprocess

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'build/simdjson-parity'
DIRECTORY = BASE / 'host-abi-test'
DIRECTORY.mkdir(exist_ok=True)
chunk = 'é漢字😀\0tail\n'
(DIRECTORY / 'input.txt').write_bytes((chunk * 16384).encode('utf8'))
source = f'''@external("env", "readFile") declare function readFile(path:string):ArrayBuffer;
@external("env", "writeFile") declare function writeFile(path:string,data:string):void;
const before=memory.size();
const input=String.UTF8.decode(readFile({json.dumps(str(DIRECTORY / 'input.txt'))}));
if(input!={json.dumps(chunk,ensure_ascii=True)}.repeat(16384))throw new Error("Input differs");
if(memory.size()<=before)throw new Error("Expected memory growth");
writeFile("unicode.txt",input);
writeFile("surrogates.txt","\\ud800|\\udc00|\\ud800\\udfff|\\ud834\\udd1e");
'''
(DIRECTORY / 'parity.ts').write_text(source)

def run(command, log=None, env=None):
    result = subprocess.run([str(value) for value in command], cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env)
    if log:
        log.write_text(result.stdout)
    if result.returncode:
        raise RuntimeError(result.stdout)

run(['node', 'node_modules/assemblyscript/bin/asc.js', DIRECTORY / 'parity.ts', '-o', DIRECTORY / 'parity.wasm', '-O3', '--runtime', 'incremental', '--exportRuntime', '--exportStart', 'start'])
run([BASE / 'w2c2-host/w2c2', DIRECTORY / 'parity.wasm', DIRECTORY / 'parity.c'])
compiler = os.environ.get('W2C2_CC', '/opt/homebrew/bin/gcc-16')
for check in [0, 1]:
    binary = DIRECTORY / f'host-{check}'
    run([compiler, '-O3', '-DNDEBUG', '-mcpu=native', '-ffp-contract=off', '-std=gnu11', f'-DW2C2_RUNTIME_CHECKS={check}', '-DW2C2_SIMDE_HEADER="simde/wasm/simd128.h"', f'-I{BASE / "simde"}', f'-I{BASE / "w2c2/w2c2"}', f'-I{DIRECTORY}', DIRECTORY / 'parity.c', ROOT / 'bench/simdjson/w2c2-host.c', '-lm', '-o', binary], DIRECTORY / f'build-{check}.log')
    output = DIRECTORY / f'oracles-{check}'
    output.mkdir(exist_ok=True)
    run([binary], env={**os.environ, 'W2C2_ORACLE_DIR': str(output)})
    assert (output / 'unicode.txt').read_bytes() == (chunk * 16384).encode('utf8')
    assert (output / 'surrogates.txt').read_bytes() == ('�|�|' + chr(0x103ff) + '|𝄞').encode('utf8')
print('w2c2 host ABI passed: checked/default, memory growth, Unicode, embedded NUL and surrogate replacement')
