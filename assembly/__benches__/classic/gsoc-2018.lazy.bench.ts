// AUTO-GENERATED from the eager bench by scripts/sync-lazy-benches.mjs — do not edit by hand.
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

// NOTE: no lazy serialize bench — lazy passthrough serialize traps for
// this document (a root-level map value, or a per-class-fallback'd
// tagged-union payload whose deferred slices don't survive serialize).
// The eager bench covers serialize; lazy mode is about the parse numbers.
