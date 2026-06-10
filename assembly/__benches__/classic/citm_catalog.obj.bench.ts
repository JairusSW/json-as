// AUTO-GENERATED from the eager bench by scripts/sync-lazy-benches.mjs - do not edit by hand.
// Re-run `node scripts/sync-lazy-benches.mjs` to regenerate.
import { JSON } from "../..";
import {
  bench,
  blackbox,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";

// Dynamic JSON.Obj (de)serialize of the citm_catalog payload - schema-agnostic, for
// the JSON.Obj series on the classic charts. Deserialize parses and touches a
// CITM performance and event metadata projection so the benchmark does not measure a touch-nothing parse.
const prettyJson = readFile(
  "./assembly/__benches__/payloads/citm_catalog.pretty.json",
);
const minJson = readFile(
  "./assembly/__benches__/payloads/citm_catalog.min.json",
);
// Parsed once (untouched) for the passthrough serialize bench.
const doc = JSON.parse<JSON.Obj>(minJson);
const TOUCH_LIMIT: i32 = 8;

function sumValue(value: JSON.Value): f64 {
  switch (value.type) {
    case JSON.Types.Null:
      return 0.0;
    case JSON.Types.Bool:
      return value.get<bool>() ? 1.0 : 0.0;
    case JSON.Types.String:
      return <f64>value.get<string>().length;
    case JSON.Types.Object:
      return sumObj(value.get<JSON.Obj>());
    case JSON.Types.Array:
      return sumArr(value.get<JSON.Arr>());
    case JSON.Types.Raw:
      return <f64>value.get<JSON.Raw>().data.length;
    default:
      return value.toString().length;
  }
}

function sumObj(root: JSON.Obj): f64 {
  const vals = root.values();
  let s = 0.0;
  const limit = vals.length < TOUCH_LIMIT ? vals.length : TOUCH_LIMIT;
  for (let i = 0, n = limit; i < n; i++) s += sumValue(unchecked(vals[i]));
  return s;
}

function sumArr(root: JSON.Arr): f64 {
  let s = 0.0;
  const limit = root.length < TOUCH_LIMIT ? root.length : TOUCH_LIMIT;
  for (let i = 0, n = limit; i < n; i++) s += sumValue(root.at(i));
  return s;
}

function sumNumberField(root: JSON.Obj, key: string): f64 {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null
    ? 0.0
    : value.get<f64>();
}

function sumStringField(root: JSON.Obj, key: string): f64 {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null
    ? 0.0
    : <f64>value.get<string>().length;
}

function sumBoolField(root: JSON.Obj, key: string): f64 {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null
    ? 0.0
    : value.get<bool>()
      ? 1.0
      : 0.0;
}

function objField(root: JSON.Obj, key: string): JSON.Obj | null {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null
    ? null
    : value.get<JSON.Obj>();
}

function arrField(root: JSON.Obj, key: string): JSON.Arr | null {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null
    ? null
    : value.get<JSON.Arr>();
}

function sumValueKind(value: JSON.Value | null): f64 {
  return value === null || value.type == JSON.Types.Null
    ? 0.0
    : <f64>value.type;
}

function sumCitmProjection(root: JSON.Obj): f64 {
  let s = 0.0;
  const performances = arrField(root, "performances");
  if (performances !== null) {
    for (let i = 0, n = performances.length; i < n; i++) {
      const perf = performances.at(i).get<JSON.Obj>();
      s +=
        sumNumberField(perf, "eventId") +
        sumNumberField(perf, "id") +
        sumNumberField(perf, "start");
      s += sumStringField(perf, "name") + sumStringField(perf, "venueCode");
    }
  }
  const events = objField(root, "events");
  if (events !== null) {
    const vals = events.values();
    const limit = vals.length < 8 ? vals.length : 8;
    for (let i = 0, n = limit; i < n; i++) {
      const event = unchecked(vals[i]).get<JSON.Obj>();
      s +=
        sumNumberField(event, "id") +
        sumStringField(event, "name") +
        sumStringField(event, "subjectCode");
    }
  }
  return s;
}

bench(
  "Deserialize citm_catalog (JSON.Obj, pretty)",
  () => {
    blackbox(sumCitmProjection(JSON.parse<JSON.Obj>(prettyJson)));
  },
  2000,
  utf8ByteLength(prettyJson),
);
dumpToFile("citm_catalog-obj-pretty", "deserialize");

bench(
  "Deserialize citm_catalog (JSON.Obj, min)",
  () => {
    blackbox(sumCitmProjection(JSON.parse<JSON.Obj>(minJson)));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("citm_catalog-obj-min", "deserialize");

bench(
  "Serialize citm_catalog (JSON.Obj, min)",
  () => {
    blackbox(JSON.stringify(doc));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("citm_catalog-obj-min", "serialize");
