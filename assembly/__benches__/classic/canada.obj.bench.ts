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

// Dynamic JSON.Obj (de)serialize of the canada payload - schema-agnostic, for
// the JSON.Obj series on the classic charts. Deserialize parses and touches a
// Canada feature metadata projection so the benchmark does not measure a touch-nothing parse.
const prettyJson = readFile(
  "./assembly/__benches__/payloads/canada.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/canada.min.json");
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

function sumCanadaProjection(root: JSON.Obj): f64 {
  let s = sumStringField(root, "type");
  const features = arrField(root, "features");
  if (features === null) return s;
  for (let i = 0, n = features.length; i < n; i++) {
    const feature = features.at(i).get<JSON.Obj>();
    s += sumStringField(feature, "type");
    const props = objField(feature, "properties");
    if (props !== null) s += sumStringField(props, "name");
    const geom = objField(feature, "geometry");
    if (geom !== null) s += sumStringField(geom, "type");
  }
  return s;
}

bench(
  "Deserialize canada (JSON.Obj, pretty)",
  () => {
    blackbox(sumCanadaProjection(JSON.parse<JSON.Obj>(prettyJson)));
  },
  500,
  utf8ByteLength(prettyJson),
);
dumpToFile("canada-obj-pretty", "deserialize");

bench(
  "Deserialize canada (JSON.Obj, min)",
  () => {
    blackbox(sumCanadaProjection(JSON.parse<JSON.Obj>(minJson)));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("canada-obj-min", "deserialize");

bench(
  "Serialize canada (JSON.Obj, min)",
  () => {
    blackbox(JSON.stringify(doc));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("canada-obj-min", "serialize");
