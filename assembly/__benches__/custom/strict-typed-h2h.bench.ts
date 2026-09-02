import { JSON } from "../../index";
import { expect } from "../../__tests__/lib";
import { bench, blackbox } from "../lib/bench";

// Strict parsing retains the standalone RFC validator. This benchmark records
// the cost of validation plus typed materialization for future bounded-parser
// work.
@json
class StrictTelemetry {
  a: i32 = 0;
  b: u32 = 0;
  c: i64 = 0;
  d: u64 = 0;
  e: f32 = 0;
  f: f64 = 0;
  g: bool = false;
  h: i32 = 0;
  i: u32 = 0;
  j: i64 = 0;
  k: u64 = 0;
  l: f32 = 0;
  m: f64 = 0;
  n: bool = false;
  o: i32 = 0;
  p: u32 = 0;
}

// Long clean keys and values isolate strict string-scanning throughput. Twelve
// fields also exercise the same keyed fallback tier as the numeric record.
@json
class StrictStringRecord {
  account_identifier: string = "";
  display_name: string = "";
  organization_name: string = "";
  primary_location: string = "";
  preferred_language: string = "";
  notification_channel: string = "";
  current_project_name: string = "";
  deployment_environment: string = "";
  runtime_version: string = "";
  source_revision: string = "";
  release_channel: string = "";
  service_region: string = "";
}

const canonical =
  '{"a":1,"b":2,"c":3,"d":4,"e":5.5,"f":6.5,"g":true,"h":8,"i":9,"j":10,"k":11,"l":12.5,"m":13.5,"n":false,"o":15,"p":16}';
const reordered =
  '{"p":16,"o":15,"n":false,"m":13.5,"l":12.5,"k":11,"j":10,"i":9,"h":8,"g":true,"f":6.5,"e":5.5,"d":4,"c":3,"b":2,"a":1}';
const stringCanonical =
  '{"account_identifier":"acct-production-0001","display_name":"AssemblyScript Performance","organization_name":"JSON Systems Laboratory","primary_location":"North America East","preferred_language":"English United States","notification_channel":"compiler-performance","current_project_name":"Strict Parser Optimization","deployment_environment":"production-canary","runtime_version":"assemblyscript-0.28.18","source_revision":"0123456789abcdef","release_channel":"performance-preview","service_region":"us-east-primary"}';

expect(JSON.stringify(JSON.parse<StrictTelemetry>(canonical))).toBe(canonical);
expect(JSON.stringify(JSON.parse<StrictTelemetry>(reordered))).toBe(canonical);
expect(JSON.stringify(JSON.parse<StrictStringRecord>(stringCanonical))).toBe(
  stringCanonical,
);

const N = 3_000_000;

bench(
  "Strict typed telemetry - canonical",
  () => {
    blackbox(inline.always(JSON.parse<StrictTelemetry>(canonical)));
  },
  N,
  String.UTF8.byteLength(canonical),
);

bench(
  "Strict typed telemetry - reordered",
  () => {
    blackbox(inline.always(JSON.parse<StrictTelemetry>(reordered)));
  },
  N,
  String.UTF8.byteLength(reordered),
);

bench(
  "Strict string record - canonical",
  () => {
    blackbox(inline.always(JSON.parse<StrictStringRecord>(stringCanonical)));
  },
  N,
  String.UTF8.byteLength(stringCanonical),
);
