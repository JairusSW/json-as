// AUTO-GENERATED from the eager bench by scripts/sync-lazy-benches.mjs - do not edit by hand.
// Re-run `node scripts/sync-lazy-benches.mjs` to regenerate.
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
class Sponsor {

  @alias("@type")
  type: string = "";
  name: string = "";
  disambiguatingDescription: string = "";
  description: string = "";
  url: string = "";
  logo: string = "";
}


@json({ lazy: "auto" })
class Author {

  @alias("@type")
  type: string = "";
  name: string = "";
}


@json({ lazy: "auto" })
class Org {

  @alias("@context")
  context: string = "";


  @alias("@type")
  type: string = "";
  name: string = "";
  description: string = "";
  sponsor: Sponsor = new Sponsor();
  author: Author = new Author();
}

function touchRoot(root: Map<string, Org>): f64 {
  const keys = root.keys();
  let s = <f64>root.size;
  for (let i = 0, n = keys.length; i < n; i++)
    s += <f64>unchecked(keys[i]).length;
  return s;
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
    const root = JSON.parse<Map<string, Org>>(prettyJson);
    blackbox(touchRoot(root));
  },
  500,
  utf8ByteLength(prettyJson),
);
dumpToFile("gsoc-2018-lazy-pretty", "deserialize");

bench(
  "Deserialize GSOC Lazy (min)",
  () => {
    const root = JSON.parse<Map<string, Org>>(minJson);
    blackbox(touchRoot(root));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("gsoc-2018-lazy-min", "deserialize");

bench(
  "Serialize GSOC Lazy (min)",
  () => {
    blackbox(JSON.stringify(gsoc));
  },
  1000,
  utf8ByteLength(minJson),
);
dumpToFile("gsoc-2018-lazy-min", "serialize");
