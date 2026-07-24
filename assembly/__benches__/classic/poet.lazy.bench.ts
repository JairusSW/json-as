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

// poet (yyjson_benchmark): a flat array of ~8934 {desc, name, id} string
// records. Trivial uniform schema - pure struct fast path.

@json({ lazy: "auto" })
class Poem {
  desc!: string;
  name!: string;
  id!: string;
}

function touchRoot(root: Poem[]): f64 {
  let s = 0.0;
  for (let i = 0, n = root.length; i < n; i++) {
    const poem = unchecked(root[i]);
    s += <f64>poem.desc.length;
    s += <f64>poem.name.length;
    s += <f64>poem.id.length;
  }
  return s;
}

const prettyJson = readFile("./assembly/__benches__/payloads/poet.pretty.json");
const minJson = readFile("./assembly/__benches__/payloads/poet.min.json");

expect(JSON.parse<Poem[]>(minJson).length).toBe(8934);

const poet = JSON.parse<Poem[]>(prettyJson);

bench(
  "Deserialize Poet Lazy (pretty)",
  () => {
    const root = JSON.parse<Poem[]>(prettyJson);
    blackbox(touchRoot(root));
  },
  500,
  utf8ByteLength(prettyJson),
);
dumpToFile("poet-lazy-pretty", "deserialize");

bench(
  "Deserialize Poet Lazy (min)",
  () => {
    const root = JSON.parse<Poem[]>(minJson);
    blackbox(touchRoot(root));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("poet-lazy-min", "deserialize");

bench(
  "Serialize Poet Lazy (min)",
  () => {
    blackbox(JSON.stringify(poet));
  },
  1000,
  utf8ByteLength(minJson),
);
dumpToFile("poet-lazy-min", "serialize");
