import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import {
  blackbox,
  bench,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";

// gsoc-2018 (yyjson_benchmark): the document root is a dynamic-key map of ~1264
// id -> organization records (schema.org JSON-LD). Parsed as Map<string, Org>;
// the @-prefixed JSON-LD keys are aliased, and the irregular sponsor/author
// sub-objects stay JSON.Raw passthrough.

@json({ lazy: "auto" })
class Org {

  @alias("@context")
  context: string = "";


  @alias("@type")
  type: string = "";
  name: string = "";
  description: string = "";
  sponsor: JSON.Raw | null = null;
  author: JSON.Raw | null = null;
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/gsoc-2018.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/gsoc-2018.min.json");

expect(JSON.parse<Map<string, Org>>(minJson).size).toBe(1264);

const gsoc = JSON.parse<Map<string, Org>>(prettyJson);

bench(
  "Deserialize GSOC Lazy (pretty)",
  () => {
    blackbox(JSON.parse<Map<string, Org>>(prettyJson));
  },
  500,
  utf8ByteLength(prettyJson),
);
dumpToFile("gsoc-2018-lazy-pretty", "deserialize");

bench(
  "Deserialize GSOC Lazy (min)",
  () => {
    blackbox(JSON.parse<Map<string, Org>>(minJson));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("gsoc-2018-lazy-min", "deserialize");

// NOTE: no lazy serialize bench here. Serializing a *root-level*
// Map<string, LazyClass> currently traps (memory access out of bounds) in
// json-as — the lazy field-deferral path doesn't survive a top-level map value.
// (The same lazy class serializes fine as an array element or a struct field,
// e.g. citm_catalog.lazy's `events` map, so this is specific to the map root.)
// The eager gsoc-2018 bench covers serialize; here we keep the lazy *parse*
// numbers, which is what lazy mode is about.
// Keep `gsoc` referenced so it is not optimized away.
blackbox(gsoc.size);
