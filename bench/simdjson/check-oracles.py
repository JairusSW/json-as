"""Compare complete owned results, retaining exact integer values beyond 2**53."""
import hashlib
import json
from pathlib import Path
import sys

folder = Path(sys.argv[1])
case = sys.argv[2]
evidence = {}


def compare(expected, actual, location="$", context=""):
    if type(expected) is bool or type(actual) is bool:
        equal = type(expected) is type(actual) and expected is actual
    elif isinstance(expected, dict) and isinstance(actual, dict):
        equal = expected.keys() == actual.keys()
        if equal:
            for key in expected:
                compare(expected[key], actual[key], location + "." + key, context)
            return
    elif isinstance(expected, list) and isinstance(actual, list):
        equal = len(expected) == len(actual)
        if equal:
            for index, (left, right) in enumerate(zip(expected, actual)):
                compare(left, right, location + f"[{index}]", context)
            return
    elif isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        equal = expected == actual
    else:
        equal = type(expected) is type(actual) and expected == actual
    if not equal:
        raise SystemExit(f"Owned output differs: {context} at {location}: {expected!r} != {actual!r}")


def reject_constant(value):
    raise ValueError(f"Non-JSON number {value}")

for suffix in [*(f".{i}.json" for i in range(4)),
               *(f".retained-object.{i}.json" for i in range(8)),
               *(f".retained-string.{i}.json" for i in range(8))]:
    native_path = folder / ("native-" + case + suffix)
    native_data = native_path.read_bytes()
    expected = json.loads(native_data, parse_constant=reject_constant)
    for mode in ["swar", "simd"]:
        actual_path = folder / ("as-" + mode + "-" + case + suffix)
        actual_data = actual_path.read_bytes()
        actual = json.loads(actual_data, parse_constant=reject_constant)
        compare(expected, actual, context=f"{case}/{mode}/{suffix}")
        evidence[str(actual_path.name)] = {
            "bytes": len(actual_data),
            "sha256": hashlib.sha256(actual_data).hexdigest(),
            "native_sha256": hashlib.sha256(native_data).hexdigest(),
        }
output = folder / (case + ".evidence.json")
output.write_text(json.dumps(evidence, indent=2) + "\n")
print(f"Owned-output oracle passed: {case}, {len(evidence)} complete comparisons")
