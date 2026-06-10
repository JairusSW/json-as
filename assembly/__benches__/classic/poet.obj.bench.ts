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

// Dynamic JSON.Arr (de)serialize of the poet payload - schema-agnostic, for
// the JSON.Obj series on the classic charts. Deserialize parses and touches a
// Poet record string-field projection so the benchmark does not measure a touch-nothing parse.
const prettyJson = readFile("./assembly/__benches__/payloads/poet.pretty.json");
const minJson = readFile("./assembly/__benches__/payloads/poet.min.json");
// Parsed once (untouched) for the passthrough serialize bench.
const doc = JSON.parse<JSON.Arr>(minJson);
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

function sumPoetProjection(root: JSON.Arr): f64 {
  let s = 0.0;
  for (let i = 0, n = root.length; i < n; i++) {
    const poem = root.at(i).get<JSON.Obj>();
    s +=
      sumStringField(poem, "desc") +
      sumStringField(poem, "name") +
      sumStringField(poem, "id");
  }
  return s;
}

bench(
  "Deserialize poet (JSON.Obj, pretty)",
  () => {
    blackbox(sumPoetProjection(JSON.parse<JSON.Arr>(prettyJson)));
  },
  500,
  utf8ByteLength(prettyJson),
);
dumpToFile("poet-obj-pretty", "deserialize");

bench(
  "Deserialize poet (JSON.Obj, min)",
  () => {
    blackbox(sumPoetProjection(JSON.parse<JSON.Arr>(minJson)));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("poet-obj-min", "deserialize");

bench(
  "Serialize poet (JSON.Obj, min)",
  () => {
    blackbox(JSON.stringify(doc));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("poet-obj-min", "serialize");
