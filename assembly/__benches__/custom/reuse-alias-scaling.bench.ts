import { JSON } from "../..";
import { bench, blackbox } from "../lib/bench";


@json
class ReuseAliasItem {
  id: i32 = 0;
}

let arrayInput = "";
let arrayOut: ReuseAliasItem[] = [];
let mapInput = "";
let mapOut = new Map<string, ReuseAliasItem>();
let scalarMapInput = "";
let scalarMapOut = new Map<string, i32>();

function buildArrayInput(count: i32): string {
  let input = "[";
  for (let i = 0; i < count; i++) {
    if (i) input += ",";
    input += '{"id":' + i.toString() + "}";
  }
  return input + "]";
}

function buildMapInput(count: i32): string {
  let input = "{";
  for (let i = 0; i < count; i++) {
    if (i) input += ",";
    input += '"k' + i.toString() + '":{"id":' + i.toString() + "}";
  }
  return input + "}";
}

function buildScalarMapInput(count: i32): string {
  let input = "{";
  for (let i = 0; i < count; i++) {
    if (i) input += ",";
    input += '"k' + i.toString() + '":' + i.toString();
  }
  return input + "}";
}

function parseArrayReuse(): void {
  blackbox(JSON.parse<ReuseAliasItem[]>(arrayInput, arrayOut));
}

function parseMapReuse(): void {
  blackbox(JSON.parse<Map<string, ReuseAliasItem>>(mapInput, mapOut));
}

function parseScalarMapReuse(): void {
  blackbox(JSON.parse<Map<string, i32>>(scalarMapInput, scalarMapOut));
}

const sizes: i32[] = [100, 1_000, 5_000];
const arrayOps: u64[] = [50_000, 5_000, 1_000];
const mapOps: u64[] = [20_000, 2_000, 400];

for (let i = 0; i < sizes.length; i++) {
  const count = unchecked(sizes[i]);
  arrayInput = buildArrayInput(count);
  arrayOut = JSON.parse<ReuseAliasItem[]>(arrayInput);
  bench(
    "Struct array reuse (" + count.toString() + ")",
    parseArrayReuse,
    unchecked(arrayOps[i]),
    String.UTF8.byteLength(arrayInput),
  );

  mapInput = buildMapInput(count);
  mapOut = JSON.parse<Map<string, ReuseAliasItem>>(mapInput);
  bench(
    "Struct map reuse (" + count.toString() + ")",
    parseMapReuse,
    unchecked(mapOps[i]),
    String.UTF8.byteLength(mapInput),
  );

  scalarMapInput = buildScalarMapInput(count);
  scalarMapOut = JSON.parse<Map<string, i32>>(scalarMapInput);
  bench(
    "Scalar map reuse (" + count.toString() + ")",
    parseScalarMapReuse,
    unchecked(mapOps[i]),
    String.UTF8.byteLength(scalarMapInput),
  );
}
